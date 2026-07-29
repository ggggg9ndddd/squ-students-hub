const AI_WORKER_URL = 'PASTE_YOUR_CLOUDFLARE_WORKER_URL_HERE';
const DAILY_LIMIT = 10;
const form = document.querySelector('#aiForm');
const task = document.querySelector('#aiTask');
const input = document.querySelector('#aiInput');
const result = document.querySelector('#aiResult');
const statusText = document.querySelector('#resultStatus');
const generateButton = document.querySelector('#generateButton');
const copyButton = document.querySelector('#copyResult');
const counter = document.querySelector('#dailyCounter');
const quizOptions = document.querySelector('#quizOptions');
const planOptions = document.querySelector('#planOptions');

function todayKey(){return `squ-ai-${new Date().toISOString().slice(0,10)}`}
function usedToday(){return Number(localStorage.getItem(todayKey())||0)}
function updateCounter(){counter.textContent=`المتبقي: ${Math.max(0,DAILY_LIMIT-usedToday())}`}
function updateOptions(){quizOptions.hidden=task.value!=='quiz';planOptions.hidden=task.value!=='plan'}
function escapeHTML(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function renderText(text){return escapeHTML(text).replace(/^### (.+)$/gm,'<h3>$1</h3>').replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^# (.+)$/gm,'<h1>$1</h1>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/^[-*] (.+)$/gm,'<li>$1</li>').replace(/(?:<li>.*<\/li>\n?)+/g,m=>`<ul>${m}</ul>`).replace(/\n/g,'<br>')}

task.addEventListener('change',updateOptions);
input.addEventListener('input',()=>document.querySelector('#charCount').textContent=`${input.value.length} / 12000`);
document.querySelector('#clearResult').addEventListener('click',()=>{result.className='ai-result empty-result';result.textContent='اختر المهمة، أدخل النص، ثم اضغط «ابدأ الآن».';copyButton.disabled=true;statusText.textContent='ستظهر النتيجة هنا.'});
copyButton.addEventListener('click',async()=>{await navigator.clipboard.writeText(result.dataset.raw||result.innerText);copyButton.textContent='تم النسخ ✓';setTimeout(()=>copyButton.textContent='نسخ',1500)});

form.addEventListener('submit',async e=>{
 e.preventDefault();
 if(AI_WORKER_URL.includes('PASTE_YOUR')){alert('أضف رابط Cloudflare Worker داخل ملف ai.js أولًا.');return}
 if(usedToday()>=DAILY_LIMIT){alert('وصلت إلى الحد اليومي للمساعد الذكي. جرّب غدًا.');return}
 const text=input.value.trim(); if(text.length<20)return;
 generateButton.disabled=true;generateButton.textContent='جارٍ إعداد النتيجة…';
 result.className='ai-result loading-result';result.textContent='يفكر المساعد ويجهز الإجابة…';statusText.textContent='يرجى الانتظار.';copyButton.disabled=true;
 try{
  const response=await fetch(AI_WORKER_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task:task.value,text,language:document.querySelector('#aiLanguage').value,level:document.querySelector('#aiLevel').value,quizType:document.querySelector('#quizType').value,quizCount:Number(document.querySelector('#quizCount').value),examDate:document.querySelector('#examDate').value,dailyHours:Number(document.querySelector('#dailyHours').value)})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'تعذر الاتصال بالمساعد الذكي.');
  localStorage.setItem(todayKey(),String(usedToday()+1));updateCounter();
  result.dataset.raw=data.text;result.className='ai-result';result.innerHTML=renderText(data.text);statusText.textContent='اكتملت النتيجة.';copyButton.disabled=false;
 }catch(err){result.className='ai-result error-result';result.textContent=err.message;statusText.textContent='حدث خطأ.'}
 finally{generateButton.disabled=false;generateButton.textContent='ابدأ الآن ✨'}
});
updateOptions();updateCounter();
