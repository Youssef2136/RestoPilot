import type { PostgrestError, PostgrestSingleResponse } from '@supabase/supabase-js'
import { getSupabaseClient } from '../../lib/supabase'
import type { Database } from '../../types/database.types'

/**
 * Management client module (contracts/management-client.md §1) — the typed
 * wrapper over the management RPCs and the ONLY import path for them in
 * application code: pages never call `supabase.rpc` directly, so the result
 * shaping and the error mapping below stay auditable in one place.
 *
 * The module carries NO authorization logic, NO retries, and NO optimistic
 * writes — every wrapper performs one RPC round trip and reports the server's
 * own outcome (the enforced boundary is the RPC surface; Constitution IV).
 * A raw database error never reaches the caller (contract §1/§5): `42501`
 * becomes the module's generic denial message, `P0001` the server's
 * human-written validation message verbatim, and anything else the generic
 * retry message — a true last resort.
 */

export type Weekday = Database['public']['Enums']['weekday']
export type StaffRole = Database['public']['Enums']['staff_role']

export type RestaurantRow = Database['public']['Tables']['restaurants']['Row']
export type BranchRow = Database['public']['Tables']['branches']['Row']
export type DiningTableRow = Database['public']['Tables']['dining_tables']['Row']
export type WorkingHoursRow = Database['public']['Tables']['branch_working_hours']['Row']
export type StaffMembershipRow = Database['public']['Tables']['staff_memberships']['Row']

/** The one result shape every wrapper returns (contract §1). */
export type ManagementResult<T> = { ok: true; data: T } | { ok: false; message: string }

/** SQLSTATE `42501` (`insufficient_privilege`) ⇒ this generic denial (contract §1/§5). */
export const MANAGEMENT_DENIED_MESSAGE =
  'Not permitted. Your account does not have permission to perform this action.'

/** Anything the RPCs never produce (e.g. a transient failure) ⇒ this retry (contract §1). */
export const MANAGEMENT_RETRY_MESSAGE = 'The request could not be completed. Please try again.'

/** One weekly interval as `replace_branch_working_hours` receives it (contract §1). */
export type WorkingHoursInterval = {
  weekday: Weekday
  open_time: string
  close_time: string
}

export interface CreateRestaurantInput {
  name: string
  slug: string
  brandDescription?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  timezone?: string
}

export interface UpdateRestaurantProfileInput {
  restaurantId: string
  name: string
  slug: string
  brandDescription?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
}

export interface UpdateRestaurantSettingsInput {
  restaurantId: string
  timezone: string
}

export interface CreateBranchInput {
  restaurantId: string
  name: string
}

export interface RenameBranchInput {
  branchId: string
  name: string
}

export interface ReplaceBranchWorkingHoursInput {
  branchId: string
  intervals: WorkingHoursInterval[]
}

export interface CreateDiningTableInput {
  branchId: string
  label: string
}

export interface RenameDiningTableInput {
  diningTableId: string
  label: string
}

export interface SetDiningTableActiveInput {
  diningTableId: string
  active: boolean
}

/** One membership in the staff RPCs' return shape (contract §Staff operations). */
export interface StaffMembershipSummary {
  id: string
  profile_id: string
  restaurant_id: string
  role: StaffRole
  branch_id: string | null
}

export interface AddStaffMemberInput {
  restaurantId: string
  email: string
  displayName: string
  role: StaffRole
  /** Required for the branch-scoped roles; omitted/null for `owner`. */
  branchId?: string | null
}

/**
 * The `add_staff_member` return shape (contract §Staff operations):
 * `person_created` is true only for a brand-new person; `temporary_password`
 * is non-null ONLY when a credential was issued — a new person, or an
 * unclaimed stub whose account was completed. The credential is displayed
 * once by the owner, is never logged or persisted by this module, and can be
 * rotated through the platform's password-recovery flow.
 */
export interface AddedStaffMember {
  membership: StaffMembershipSummary
  profile_id: string
  person_created: boolean
  temporary_password: string | null
}

export interface UpdateStaffMembershipInput {
  membershipId: string
  role: StaffRole
  /** Required for the branch-scoped roles; omitted/null for `owner`. */
  branchId?: string | null
}

export interface RemoveStaffMembershipInput {
  membershipId: string
}

/**
 * The module's one error mapper (contract §1/§5): the two SQLSTATEs the
 * management RPCs produce have defined presentations; everything else is a
 * true last resort (the RPCs translate every constraint violation they can
 * hit — a mapping gap is not expected). Never returns a raw database message.
 */
function mapRpcError(error: PostgrestError): { ok: false; message: string } {
  if (error.code === '42501') {
    return { ok: false, message: MANAGEMENT_DENIED_MESSAGE }
  }
  if (error.code === 'P0001') {
    // The server writes these messages for humans (validation and translated
    // constraint violations) — shown verbatim, form state preserved by the page.
    return { ok: false, message: error.message }
  }
  return { ok: false, message: MANAGEMENT_RETRY_MESSAGE }
}

/** Awaits one RPC round trip and normalizes it into the module's result shape. */
async function settle<T>(
  request: PromiseLike<PostgrestSingleResponse<T>>,
): Promise<ManagementResult<T>> {
  try {
    const { data, error } = await request
    if (error !== null) {
      return mapRpcError(error)
    }
    if (data === null) {
      // These RPCs always return their stored row(s); a successful response
      // without one is a protocol anomaly, never a business outcome.
      return { ok: false, message: MANAGEMENT_RETRY_MESSAGE }
    }
    return { ok: true, data }
  } catch {
    // The data API resolves request failures into `error`; a throw here is a
    // client-side failure — the retry message is the last resort either way.
    return { ok: false, message: MANAGEMENT_RETRY_MESSAGE }
  }
}

/**
 * Awaits one VOID-returning RPC round trip (`remove_staff_membership` returns
 * nothing by contract). Success is the absence of an error: there is no
 * payload to pass through, so the null-payload anomaly rule of `settle` does
 * not apply here — it would report every removal as a failure.
 */
async function settleVoid(
  request: PromiseLike<PostgrestSingleResponse<undefined>>,
): Promise<ManagementResult<undefined>> {
  try {
    const { error } = await request
    if (error !== null) {
      return mapRpcError(error)
    }
    return { ok: true, data: undefined }
  } catch {
    return { ok: false, message: MANAGEMENT_RETRY_MESSAGE }
  }
}

export const managementClient = {
  /**
   * FR-001: create the tenant; the caller's linked profile becomes its owner
   * in the same transaction. Any linked profile may call this (the RPC
   * decides — this module carries no authorization logic).
   */
  async createRestaurant(input: CreateRestaurantInput): Promise<ManagementResult<RestaurantRow>> {
    return settle(
      getSupabaseClient().rpc('create_restaurant', {
        p_name: input.name,
        p_slug: input.slug,
        p_brand_description: input.brandDescription ?? undefined,
        p_contact_email: input.contactEmail ?? undefined,
        p_contact_phone: input.contactPhone ?? undefined,
        p_timezone: input.timezone ?? undefined,
      }),
    )
  },

  /** FR-002/FR-004: the full profile update (identifier change included). */
  async updateRestaurantProfile(
    input: UpdateRestaurantProfileInput,
  ): Promise<ManagementResult<RestaurantRow>> {
    return settle(
      getSupabaseClient().rpc('update_restaurant_profile', {
        p_restaurant_id: input.restaurantId,
        p_name: input.name,
        p_slug: input.slug,
        p_brand_description: input.brandDescription ?? undefined,
        p_contact_email: input.contactEmail ?? undefined,
        p_contact_phone: input.contactPhone ?? undefined,
      }),
    )
  },

  /** FR-003: the restaurant-level basic settings (timezone). */
  async updateRestaurantSettings(
    input: UpdateRestaurantSettingsInput,
  ): Promise<ManagementResult<RestaurantRow>> {
    return settle(
      getSupabaseClient().rpc('update_restaurant_settings', {
        p_restaurant_id: input.restaurantId,
        p_timezone: input.timezone,
      }),
    )
  },

  /** FR-007: create a branch under the restaurant. */
  async createBranch(input: CreateBranchInput): Promise<ManagementResult<BranchRow>> {
    return settle(
      getSupabaseClient().rpc('create_branch', {
        p_restaurant_id: input.restaurantId,
        p_name: input.name,
      }),
    )
  },

  /** FR-007: edit a branch's name (identity and attachments unaffected). */
  async renameBranch(input: RenameBranchInput): Promise<ManagementResult<BranchRow>> {
    return settle(
      getSupabaseClient().rpc('rename_branch', {
        p_branch_id: input.branchId,
        p_name: input.name,
      }),
    )
  },

  /**
   * FR-008/FR-009: replace the branch's whole weekly schedule atomically. The
   * zero-length/overlap rejection is the server's — the returned `P0001`
   * message is surfaced verbatim and the stored schedule stays unchanged.
   */
  async replaceBranchWorkingHours(
    input: ReplaceBranchWorkingHoursInput,
  ): Promise<ManagementResult<WorkingHoursRow[]>> {
    return settle(
      getSupabaseClient().rpc('replace_branch_working_hours', {
        p_branch_id: input.branchId,
        p_intervals: input.intervals,
      }),
    )
  },

  /** FR-010: create a table in a chosen branch (label unique within it). */
  async createDiningTable(
    input: CreateDiningTableInput,
  ): Promise<ManagementResult<DiningTableRow>> {
    return settle(
      getSupabaseClient().rpc('create_dining_table', {
        p_branch_id: input.branchId,
        p_label: input.label,
      }),
    )
  },

  /** FR-011: rename/renumber a table, including while inactive. */
  async renameDiningTable(
    input: RenameDiningTableInput,
  ): Promise<ManagementResult<DiningTableRow>> {
    return settle(
      getSupabaseClient().rpc('rename_dining_table', {
        p_dining_table_id: input.diningTableId,
        p_label: input.label,
      }),
    )
  },

  /** FR-011/FR-012: the explicit activation state (repeat transitions are no-ops). */
  async setDiningTableActive(
    input: SetDiningTableActiveInput,
  ): Promise<ManagementResult<DiningTableRow>> {
    return settle(
      getSupabaseClient().rpc('set_dining_table_active', {
        p_dining_table_id: input.diningTableId,
        p_active: input.active,
      }),
    )
  },

  /**
   * FR-013/FR-014: add a person to the restaurant's staff — provisioning a
   * new identity with a one-time temporary credential, or linking an existing
   * person by email (`temporary_password === null`). The credential never
   * leaves this result object: it is not logged and not stored.
   */
  async addStaffMember(input: AddStaffMemberInput): Promise<ManagementResult<AddedStaffMember>> {
    const result = await settle(
      getSupabaseClient().rpc('add_staff_member', {
        p_restaurant_id: input.restaurantId,
        p_email: input.email,
        p_display_name: input.displayName,
        p_role: input.role,
        p_branch_id: input.branchId ?? undefined,
      }),
    )
    if (!result.ok) {
      return result
    }
    // The RPC's jsonb payload is the contract's structure; the generated
    // `Json` return type carries no keys of its own.
    return { ok: true, data: result.data as unknown as AddedStaffMember }
  },

  /** FR-015: change a membership's role and/or branch (identity untouched). */
  async updateStaffMembership(
    input: UpdateStaffMembershipInput,
  ): Promise<ManagementResult<StaffMembershipRow>> {
    return settle(
      getSupabaseClient().rpc('update_staff_membership', {
        p_membership_id: input.membershipId,
        p_role: input.role,
        p_branch_id: input.branchId ?? undefined,
      }),
    )
  },

  /**
   * FR-015/FR-016: remove a membership. Access ends immediately; the person's
   * profile and sign-in identity persist. A last-owner removal is rejected by
   * the server (`P0001`, surfaced verbatim).
   */
  async removeStaffMembership(
    input: RemoveStaffMembershipInput,
  ): Promise<ManagementResult<undefined>> {
    return settleVoid(
      getSupabaseClient().rpc('remove_staff_membership', {
        p_membership_id: input.membershipId,
      }),
    )
  },
}
