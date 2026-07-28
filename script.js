const colleges=[['🌿','العلوم الزراعية والبحرية','1,280 طالب'],['⚙️','الهندسة','2,140 طالب'],['🧪','العلوم','1,930 طالب'],['💼','الاقتصاد والعلوم السياسية','2,010 طالب'],['⚖️','الحقوق','960 طالب'],['📚','الآداب والعلوم الاجتماعية','2,320 طالب'],['🩺','الطب والعلوم الصحية','1,440 طالب'],['🎓','التربية','1,760 طالب']];
const summaries=[
 {title:'اقتصاديات الموارد الطبيعية',college:'العلوم الزراعية والبحرية',type:'ملخص',code:'NRE 3020',pages:24,author:'ناصر الرمحي'},
 {title:'التفاضل والتكامل 1',college:'العلوم',type:'شرح',code:'MATH 2107',pages:31,author:'مريم الهنائية'},
 {title:'مبادئ الإدارة',college:'الاقتصاد والعلوم السياسية',type:'اختبار سابق',code:'MNGT 1001',pages:12,author:'أحمد الرواحي'},
 {title:'ميكانيكا الموائع',college:'الهندسة',type:'ملخص',code:'MEIE 3202',pages:27,author:'سارة البلوشية'},
 {title:'القانون الدستوري',college:'الحقوق',type:'ملخص',code:'LAWW 2104',pages:19,author:'خالد المعمري'},
 {title:'علم النفس التربوي',college:'التربية',type:'شرح',code:'EDUC 2201',pages:22,author:'هدى الشحية'}
];
const posts=[
 {name:'مريم الهنائية',college:'كلية العلوم',text:'رفعت اليوم ملخصًا جديدًا لمادة التفاضل والتكامل، مرتب حسب المحاضرات مع أمثلة محلولة. أتمنى يفيدكم 🤍',likes:124,comments:18},
 {name:'أحمد الرواحي',college:'كلية الاقتصاد والعلوم السياسية',text:'من لديه تجربة مع التدريب الصيفي في القطاع المصرفي؟ أبحث عن نصائح حول المقابلات وطريقة تجهيز السيرة الذاتية.',likes:67,comments:31}
];
const news=[['29 يوليو 2026','فتح باب التسجيل في الأنشطة الطلابية','تعرف على الجماعات الطلابية ومواعيد التسجيل الجديدة.'],['28 يوليو 2026','ورشة مجانية في الذكاء الاصطناعي','ورشة عملية للطلاب حول استخدام أدوات الذكاء الاصطناعي في الدراسة.'],['27 يوليو 2026','تحديث مواعيد الحافلات','تم نشر الجدول المحدث لمسارات الحافلات داخل الحرم الجامعي.']];
const storyNames=['العلوم','الهندسة','الطب','الحقوق','الاقتصاد'];
const $=s=>document.querySelector(s);
const grid=$('#collegeGrid'); colleges.forEach(c=>grid.insertAdjacentHTML('beforeend',`<article class="college-card"><div class="college-icon">${c[0]}</div><h3>${c[1]}</h3><p>${c[2]} • مجتمع نشط</p></article>`));
const collegeFilter=$('#collegeFilter'); [...new Set(summaries.map(s=>s.college))].forEach(c=>collegeFilter.insertAdjacentHTML('beforeend',`<option>${c}</option>`));
function renderSummaries(){const q=$('#searchInput').value.trim().toLowerCase(),college=collegeFilter.value,type=$('#typeFilter').value;const data=summaries.filter(s=>(s.title.toLowerCase().includes(q)||s.code.toLowerCase().includes(q))&&(college==='all'||s.college===college)&&(type==='all'||s.type===type));$('#summaryGrid').innerHTML=data.map(s=>`<article class="summary-card"><div class="summary-top"><div class="file-icon">📄</div><span class="badge">${s.type}</span></div><h3>${s.title}</h3><p>${s.college} • ${s.code}</p><div class="meta"><span>${s.pages} صفحة</span><span>بواسطة ${s.author}</span></div></article>`).join('')||'<p>لا توجد نتائج مطابقة.</p>'}
renderSummaries();['searchInput','collegeFilter','typeFilter'].forEach(id=>$('#'+id).addEventListener('input',renderSummaries));
$('#feed').innerHTML=posts.map(p=>`<article class="post"><div class="post-head"><div class="avatar">${p.name[0]}</div><div><strong>${p.name}</strong><small>${p.college} • منذ ساعتين</small></div></div><p>${p.text}</p><div class="post-actions"><span>♡ ${p.likes}</span><span>💬 ${p.comments}</span><span>↗ مشاركة</span></div></article>`).join('');
$('#newsList').innerHTML=news.map(n=>`<article class="news-item"><time>${n[0]}</time><h3>${n[1]}</h3><p>${n[2]}</p></article>`).join('');
$('#stories').innerHTML=storyNames.map((n,i)=>`<div class="story"><div class="story-avatar"><b>${['🌿','⚙️','🩺','⚖️','💼'][i]}</b></div><small>${n}</small></div>`).join('');
const modal=$('#modal');function openModal(title,text){$('#modalTitle').textContent=title;$('#modalText').textContent=text;modal.showModal()}
$('#googleLogin').onclick=()=>openModal('تسجيل الدخول بجوجل','الواجهة جاهزة، ويتطلب التشغيل الفعلي إضافة إعدادات Firebase الخاصة بالمشروع.');
$('#uploadButton').onclick=()=>openModal('رفع الملخصات','سيتم تفعيل رفع PDF والصور بعد ربط Firebase Storage وقواعد المراجعة.');
$('#newPost').onclick=()=>openModal('إنشاء منشور','سيتم تفعيل المنشورات والتعليقات عند ربط قاعدة البيانات.');
$('#themeToggle').onclick=()=>{document.body.classList.toggle('light');$('#themeToggle').textContent=document.body.classList.contains('light')?'☀':'☾'};
document.querySelectorAll('[data-scroll]').forEach(b=>b.onclick=()=>document.querySelector(b.dataset.scroll).scrollIntoView());
document.querySelectorAll('.nav-links a').forEach(a=>a.onclick=()=>{document.querySelectorAll('.nav-links a').forEach(x=>x.classList.remove('active'));a.classList.add('active')});
