# دليل بيانات الاختبار (RestoPilot)

كل البيانات أدناه **مُحمَّلة مسبقاً** في قاعدة بيانات التطوير عبر `npm run db:reset -- --yes` ثم `npm run db:seed`. لا تحتاج لإدخال أي بيانات يدوياً.

---

## 1) حسابات الموظفين — تسجيل الدخول من `/signin`

جميع الحسابات مُنشأة في Supabase Auth ومرتبطة ببروفايلات وم memberships جاهزة:

| الشخصية            | البريد الإلكتروني               | كلمة المرور               | الدور والنطاق                                                                                                        |
| ------------------ | ------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Alice**          | `alice@restopilot.dev`          | `dev-alice-2026`          | **مالكة** مطعم Blue Olive (كل الفروع: Downtown + Marina) — ترى كل شيء أيضاً في Cedar Grill؟ لا: ملكية Blue Olive فقط |
| **Bob**            | `bob@restopilot.dev`            | `dev-bob-2026`            | **مدير فرع Downtown** (Blue Olive)                                                                                   |
| **Carla**          | `carla@restopilot.dev`          | `dev-carla-2026`          | **كاشير Downtown** — لوحة الشاشات: `/dashboard/rounds`                                                               |
| **Dan**            | `dan@restopilot.dev`            | `dev-dan-2026`            | **مطبخ Marina** — لوحة المطبخ: `/dashboard/kitchen`                                                                  |
| **Eve**            | `eve@restopilot.dev`            | `dev-eve-2026`            | **مالكة Cedar Grill + كاشيرة Downtown** (دور مزدوج مقصود لاختبار العبور)                                             |
| **Fiona**          | `fiona@restopilot.dev`          | `dev-fiona-2026`          | **بدون أي صلاحية** — لاختبار الرفض (كل الشاشات ترفضها)                                                               |
| **Platform Admin** | `platform-admin@restopilot.dev` | `dev-platform-admin-2026` | **مشرف المنصة** — منطقة `/admin`                                                                                     |

## 2) المطاعم والفروع والطاولات (بيانات القائمة العامة)

| العنصر          | القيمة                                                         |
| --------------- | -------------------------------------------------------------- |
| مطعم 1          | **Blue Olive** — الرابط العام: `/r/blue-olive`                 |
| مطعم 2          | **Cedar Grill** — `/r/cedar-grill`                             |
| فروع Blue Olive | **Downtown** و **Marina**                                      |
| فرع Cedar Grill | **Airport**                                                    |
| طاولات Downtown | T1 و T2 و T3 (كلها نشطة)                                       |
| طاولة Marina    | T1 (متوقفة عن العمل عمداً — لاختبار إخفاء الطاولات غير النشطة) |
| طاولة Airport   | T1 (نشطة)                                                      |

## 3) جلسات تجريبية مفتوحة (توكنات الديمو)

جدولان لديهما جلسات مفتوحة جاهزة بتوكنات ثابتة في `localStorage`:

| التوكن                       | الجلسة                 |
| ---------------------------- | ---------------------- |
| `dev-token-downtown-t1-2026` | جلسة طاولة Downtown T1 |
| `dev-token-downtown-t2-2026` | جلسة طاولة Downtown T2 |

طريقة الاستخدام: افتح تبويب المتصفح → DevTools → Console واكتب:

```js
localStorage.setItem('restopilot.session-token', 'dev-token-downtown-t1-2026')
```

ثم افتح `/r/blue-olive/menu` — ستجد الجلسة جاهزة مع سجل الطلبات (history) والسلة.

**ملاحظة**: التوكن يبقى في الجهاز، لذا عند الانتهاء نظّفه:

```js
localStorage.removeItem('restopilot.session-token')
```

## 4) دخول العميل من الصفر (بدون توكن)

1. افتح `/r/blue-olive`
2. اختر الفرع (Downtown أو Marina) ثم الطاولة (فقط النشطة تظهر)
3. أدخل الاسم (1–60 حرف) ورقم الهاتف
4. اضغط **"Join the table"** → تُفتح جلسة جديدة ويُحفظ التوكن تلقائياً في `localStorage` تحت المفتاح `restopilot.session-token`

## 5) دورة الطلب الكاملة (اختبار يدوي شامل)

1. **العميل**: `/r/blue-olive` → Downtown T1 → أدخل الاسم/الهاتف → من قائمة الطعام أضف أصناف (جرّب الإضافات Extras) → **Send order to the kitchen**
2. **الكاشير (carla)**: سجّل الدخول → `/dashboard/rounds` → ستجد الطلب في مجموعة "new" → **Accept round** → جرّب **Reduce one / Remove line** قبل التحضير
3. **الكاشير أو المدير**: **Start preparation** → **Mark ready** → **Lock round** (القفل نهائي — لا رجوع)
4. **المطبخ (dan)**: `/dashboard/kitchen` — يرى تذاكر Marina فقط **بدون أي أسعار** (القرار التصميمي: المطبخ لا يرى المال) — أزرار Start/Mark ready فقط
5. **الفاتورة (carla)**: اختر **Show bill** على أي طلب → المجموع الكلي يساوي تماماً مجموع القيم الملتقطة وقت الطلب (وليس أسعار القائمة الحالية)

## 6) تجارب الصلاحيات (السيناريوهات الأمنية)

- سجّل دخول **dan** وجرّب فتح `/dashboard/rounds` → صفحة رفض صريحة (ليس إخفاء)
- سجّل دخول **fiona** → كل شاشات الموظفين ترفضها
- **eve** تستطيع الوصول لـ Downtown ككاشيرة رغم أنها مالكة مطعم آخر (اختبار العبور المقصود)
- انتبه: في مرحلة 8 تم _توسيع_ قيود الحالة — الحالة `'lock'` **نهائية** ولا يمكن أي انتقال بعدها

## 7) أخطاء مقصودة للتجربة

- أدخل اسماً فارغاً أو أطول من 60 حرف في شاشة الدخول → رسالة تحقق فورية
- غيّر التوكن في `localStorage` لقيمة عشوائية ثم افتح القائمة → "**This session is no longer available**" ويُمسح التوكن تلقائياً
- افتح نفس الطاولة من نافذتين → نفس الجلسة (انضمام مشارك)

## 8) إعادة الحالة للبداية

```bash
npm run db:reset -- --yes   # يعيد بناء القاعدة من الصفر (يدمّر البيانات)
npm run db:seed             # يزرع كل البيانات أعلاه من جديد
```

---

## معلومات تقنية (للمطورين)

- بيانات هذا الدليل مصدرها: `scripts/db/seed.mjs` و `tests/database/helpers/fixtures.ts` (مصدر واحد للحقيقة)
- ثوابت الـ UUIDs كلها في `fixtures.ts` (مثل `00000000-0000-4000-8000-...`) — ثابتة عبر كل الاختبارات والسكربتات
- سلسلة الـ RPCs: `open_session_at_table` → `submit_round` → `accept_round` → `start_preparation` → `mark_round_ready` → `lock_round` → `modify_round_line`
- سكربت التجول الآلي: `node --env-file-if-exists=.env scripts/run-staffops-walkthroughs.mjs` (يشغّل 24 فحصاً e2e ويطبع PASS/FAIL)
