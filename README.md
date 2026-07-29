# SQU Drive Hub — النسخة النظيفة

هذه النسخة أُعيد بناؤها من الصفر، وحُذفت منها ميزات الأمس المعقدة.

## الموجود
- تسجيل الدخول بحساب Google.
- ملف شخصي لكل مستخدم: الاسم، الكلية، التخصص، والنبذة.
- صفحة مستقلة لكل قسم.
- إضافة رابط Google Drive فقط.
- حذف المستخدم لملفه الذي أضافه.
- بحث داخل كل قسم.
- تصميم متجاوب ووضع ليلي.

## الصفحات
- index.html
- summaries.html
- lectures.html
- exams.html
- assignments.html
- projects.html
- other.html
- profile.html

## تشغيل المشروع
1. ارفع جميع الملفات إلى جذر مستودع GitHub.
2. فعّل GitHub Pages من الفرع main والجذر `/`.
3. في Firebase Authentication > Settings > Authorized domains أضف نطاق GitHub Pages، مثل:
   `dralrumhi-tech.github.io`
4. في Firestore Database > Rules امسح كل الموجود والصق محتوى `firestore.rules` ثم اضغط Publish.

## مهم
لا تضع كود firebase-config.js داخل Firestore Rules. ملف القواعد يقبل فقط محتوى firestore.rules.
