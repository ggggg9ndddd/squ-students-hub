# SQU Drive Hub
نسخة مبسطة لمشاركة روابط Google Drive بين الطلاب.

## طريقة التشغيل
1. ارفع الملفات إلى مستودع GitHub Pages.
2. أضف نطاق GitHub Pages في Firebase Authentication > Settings > Authorized domains.
3. انسخ محتوى `firestore.rules` إلى Firestore Database > Rules ثم اضغط Publish.
4. افتح الموقع، سجل الدخول، ثم أضف عنوان الملف ووصفه ورابط Google Drive.

## قبل مشاركة رابط Drive
Share > General access > Anyone with the link > Viewer

لا تحتاج Firebase Storage ولا رفع صور داخل الموقع.
