# SQU Students Hub — Firebase Login V1

نسخة أولى تعمل بتسجيل الدخول عبر Google باستخدام Firebase Authentication.

## الملفات
- `index.html`
- `style.css`
- `script.js`
- `firebase-config.js`

## التشغيل
لا تفتح `index.html` مباشرة بصيغة `file://` لأن وحدات JavaScript تحتاج خادمًا.

يمكن نشر الملفات على GitHub Pages، أو تشغيلها محليًا عبر VS Code Live Server.

## إعداد Firebase المطلوب
1. Authentication > Sign-in method > Google = Enabled.
2. Authentication > Settings > Authorized domains.
3. أضف نطاق GitHub Pages الخاص بك، مثل:
   `dralrumhi-tech.github.io`

## GitHub Pages
ارفع الملفات إلى جذر المستودع، ثم:
Settings > Pages > Deploy from a branch > main > /(root)

## ملاحظة
هذه النسخة تفعّل تسجيل الدخول والخروج فقط. لا تستخدم Firebase Storage ولا تحتاج إلى الترقية لخطة مدفوعة.
