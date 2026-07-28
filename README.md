# SQU Social — منشورات وقصص وتعليقات حقيقية

نسخة عملية تعمل عبر Firebase Authentication وCloud Firestore، بدون Firebase Storage.

## الميزات
- تسجيل الدخول بحساب Google.
- منشورات صور مع وصف.
- إعجاب وإلغاء إعجاب لحظيًا.
- تعليقات حقيقية وحذف المستخدم لتعليقه.
- قصص لجميع المستخدمين، تظهر لمدة 24 ساعة.
- عداد مشاهدات لصاحب القصة.
- حذف صاحب المنشور لمنشوره.
- ضغط الصور داخل المتصفح قبل حفظها.

## خطوة ضرورية: نشر قواعد Firestore
1. افتح Firebase Console.
2. انتقل إلى Firestore Database ثم Rules.
3. انسخ محتوى ملف `firestore.rules` والصقه كاملًا.
4. اضغط Publish.

## Authorized domains
من Firebase > Authentication > Settings > Authorized domains أضف نطاق GitHub Pages، مثال:
`dralrumhi-tech.github.io`

## النشر على GitHub Pages
ارفع جميع الملفات إلى جذر المستودع ثم فعّل GitHub Pages من الفرع `main` والمجلد `/root`.

## ملاحظة تقنية مهمة
هذه النسخة تحفظ الصور المضغوطة داخل Firestore لتجنب الحاجة إلى خطة Firebase Storage المدفوعة. هذا مناسب لنسخة تجريبية صغيرة، لكنه ليس مناسبًا لآلاف الصور. عند نمو المنصة، انقل الصور إلى Cloudinary أو Firebase Storage واترك الروابط فقط داخل Firestore.
