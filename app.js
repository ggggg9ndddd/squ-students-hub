import { auth, db, googleProvider } from './firebase-config.js';
import { signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { addDoc, collection, deleteDoc, doc, getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const state = { user: null, profile: null, posts: [], opinions: [], unsubscribe: null, opinionsUnsubscribe: null };
const fallbackAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Crect width='120' height='120' rx='60' fill='%2315483f'/%3E%3Ctext x='60' y='76' text-anchor='middle' font-size='52'%3E👤%3C/text%3E%3C/svg%3E";

function escapeHTML(value='') { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function showNotice(title, text) { if (!$('#noticeDialog')) return alert(text); $('#noticeTitle').textContent = title; $('#noticeText').textContent = text; $('#noticeDialog').showModal(); }
function formatDate(ts) { return ts?.toDate ? new Intl.DateTimeFormat('ar-OM',{day:'numeric',month:'long',year:'numeric'}).format(ts.toDate()) : 'الآن'; }
function validDriveUrl(value) { try { const u = new URL(value); return u.protocol === 'https:' && ['drive.google.com','docs.google.com'].includes(u.hostname); } catch { return false; } }
function requireLogin() { if (state.user) return true; showNotice('تسجيل الدخول مطلوب','سجّل الدخول بحساب Google أولًا.'); return false; }

async function ensureUser(user) {
  const ref = doc(db,'users',user.uid);
  const snap = await getDoc(ref);
  const current = snap.exists() ? snap.data() : {};
  const data = {
    uid:user.uid,
    name:current.name || user.displayName || 'مستخدم',
    email:user.email || '',
    photoURL:user.photoURL || '',
    college:current.college || '',
    major:current.major || '',
    bio:current.bio || '',
    lastSeen:serverTimestamp()
  };
  await setDoc(ref,data,{merge:true});
  state.profile = {...current,...data};
}

function updateAuthUI() {
  const login = $('#googleLogin');
  const menu = $('#userMenu');
  if (!login || !menu) return;
  if (state.user) {
    login.hidden = true; menu.hidden = false;
    $('#userPhoto').src = state.user.photoURL || fallbackAvatar;
    $('#userName').textContent = state.profile?.name || state.user.displayName || 'مستخدم';
    $('#userEmail').textContent = state.user.email || '';
  } else {
    login.hidden = false; menu.hidden = true;
  }
}

function startPosts() {
  if (!$('#feed')) return;
  state.unsubscribe?.();
  state.unsubscribe = onSnapshot(query(collection(db,'posts'),orderBy('createdAt','desc'),limit(200)), snap => {
    state.posts = snap.docs.map(d => ({id:d.id,...d.data()}));
    renderPosts();
  }, err => {
    console.error(err);
    $('#feed').innerHTML = '<p class="empty">تعذر تحميل الملفات. تأكد من نشر قواعد Firestore الصحيحة.</p>';
  });
}

function renderPosts() {
  const feed = $('#feed'); if (!feed) return;
  const pageCategory = document.body.dataset.category || '';
  const term = ($('#searchInput')?.value || '').trim().toLowerCase();
  let posts = state.posts.filter(p => !pageCategory || p.category === pageCategory);
  if (document.body.dataset.page === 'profile') posts = posts.filter(p => p.uid === state.user?.uid);
  if (term) posts = posts.filter(p => `${p.title||''} ${p.course||''} ${p.college||''} ${p.description||''} ${p.userName||''}`.toLowerCase().includes(term));
  if (!posts.length) { feed.innerHTML = '<p class="empty">لا توجد ملفات في هذا القسم حاليًا.</p>'; return; }
  feed.innerHTML = posts.map(p => `<article class="resource-card">
    <div class="resource-top"><span class="pill">${escapeHTML(p.category || 'ملف')}</span><span>${formatDate(p.createdAt)}</span></div>
    <p class="course">${escapeHTML(p.course || '')}${p.college ? ` · ${escapeHTML(p.college)}` : ''}</p>
    <h3>${escapeHTML(p.title || '')}</h3>
    <p class="description">${escapeHTML(p.description || '')}</p>
    <div class="author"><img class="avatar" src="${escapeHTML(p.userPhoto || fallbackAvatar)}" alt=""><div><strong>${escapeHTML(p.userName || 'مستخدم')}</strong><small>${escapeHTML(p.userCollege || '')}</small></div></div>
    <div class="resource-actions"><a class="open-link" href="${escapeHTML(p.driveUrl || '#')}" target="_blank" rel="noopener noreferrer">فتح رابط Google Drive</a>${p.uid === state.user?.uid ? `<button class="danger-btn" data-delete="${p.id}">حذف</button>` : ''}</div>
  </article>`).join('');
  $$('[data-delete]').forEach(btn => btn.onclick = async () => {
    if (!confirm('هل تريد حذف هذا الملف؟')) return;
    try { await deleteDoc(doc(db,'posts',btn.dataset.delete)); }
    catch(e) { console.error(e); showNotice('تعذر الحذف','لا يمكنك حذف ملف لا تملكه.'); }
  });
}


function startOpinions() {
  if (!$('#opinionsFeed')) return;
  state.opinionsUnsubscribe?.();
  state.opinionsUnsubscribe = onSnapshot(query(collection(db,'opinions'),orderBy('createdAt','desc'),limit(200)), snap => {
    state.opinions = snap.docs.map(d => ({id:d.id,...d.data()})); renderOpinions();
  }, err => { console.error(err); $('#opinionsFeed').innerHTML='<p class="empty">تعذر تحميل الآراء. تأكد من قواعد Firestore.</p>'; });
}
function renderOpinions(){
  const feed=$('#opinionsFeed'); if(!feed) return;
  const term=($('#opinionSearch')?.value||'').trim().toLowerCase();
  let items=state.opinions;
  if(term) items=items.filter(o=>`${o.course||''} ${o.code||''} ${o.college||''} ${o.text||''}`.toLowerCase().includes(term));
  if(!items.length){feed.innerHTML='<p class="empty">لا توجد آراء منشورة حاليًا.</p>';return;}
  feed.innerHTML=items.map(o=>`<article class="resource-card opinion-card"><div class="resource-top"><span class="pill">${escapeHTML(o.college||'كلية')}</span><span>${formatDate(o.createdAt)}</span></div><p class="course">${escapeHTML(o.code||'')}</p><h3>${escapeHTML(o.course||'')}</h3><p class="description">${escapeHTML(o.text||'')}</p><div class="author"><img class="avatar" src="${escapeHTML(o.userPhoto||fallbackAvatar)}" alt=""><div><strong>${escapeHTML(o.userName||'طالب')}</strong><small>رأي طالب</small></div></div>${o.uid===state.user?.uid?`<button class="danger-btn opinion-delete" data-opinion-delete="${o.id}">حذف رأيي</button>`:''}</article>`).join('');
  $$('[data-opinion-delete]').forEach(btn=>btn.onclick=async()=>{if(confirm('هل تريد حذف هذا الرأي؟')) await deleteDoc(doc(db,'opinions',btn.dataset.opinionDelete));});
}

function initForms() {
  $('#opinionForm')?.addEventListener('submit', async e => {
    e.preventDefault(); if(!requireLogin()) return;
    const btn=$('#publishOpinion'); btn.disabled=true; btn.textContent='جارٍ النشر…';
    try { await addDoc(collection(db,'opinions'),{uid:state.user.uid,userName:state.profile?.name||state.user.displayName||'طالب',userPhoto:state.user.photoURL||'',course:$('#opinionCourse').value.trim(),code:$('#opinionCode').value.trim(),college:$('#opinionCollege').value,text:$('#opinionText').value.trim(),createdAt:serverTimestamp()}); e.target.reset(); $('#opinionDialog').close(); }
    catch(err){console.error(err);showNotice('تعذر النشر','تأكد من نشر قواعد Firestore الجديدة.');}
    finally{btn.disabled=false;btn.textContent='نشر الرأي';}
  });
  $('#postForm')?.addEventListener('submit', async e => {
    e.preventDefault(); if (!requireLogin()) return;
    const title=$('#postTitle').value.trim(), course=$('#postCourse').value.trim(), category=$('#postCategory').value, driveUrl=$('#postLink').value.trim(), description=$('#postDescription')?.value.trim() || '', college=$('#postCollege')?.value || '';
    if (!validDriveUrl(driveUrl)) { showNotice('رابط غير صحيح','ضع رابطًا صحيحًا من Google Drive أو Google Docs.'); return; }
    const btn=$('#publishPost'); btn.disabled=true; btn.textContent='جارٍ النشر…';
    try {
      await addDoc(collection(db,'posts'),{uid:state.user.uid,userName:state.profile?.name || state.user.displayName || 'مستخدم',userPhoto:state.user.photoURL || '',userCollege:state.profile?.college || '',title,course,college,category,driveUrl,description,createdAt:serverTimestamp()});
      e.target.reset(); $('#postDialog').close();
    } catch(err) { console.error(err); showNotice('تعذر النشر','تأكد من نشر قواعد Firestore ثم حاول مرة أخرى.'); }
    finally { btn.disabled=false; btn.textContent=document.body.dataset.page==='summaries'?'نشر الملخص':'نشر الملف'; }
  });

  $('#profileForm')?.addEventListener('submit', async e => {
    e.preventDefault(); if (!requireLogin()) return;
    const btn=$('#saveProfile'); btn.disabled=true; btn.textContent='جارٍ الحفظ…';
    const profile={uid:state.user.uid,name:$('#profileName').value.trim(),email:state.user.email || '',photoURL:state.user.photoURL || '',college:$('#profileCollege').value.trim(),major:$('#profileMajor').value.trim(),bio:$('#profileBio').value.trim(),updatedAt:serverTimestamp()};
    try { await setDoc(doc(db,'users',state.user.uid),profile,{merge:true}); state.profile={...state.profile,...profile}; fillProfile(); updateAuthUI(); showNotice('تم الحفظ','تم تحديث ملفك الشخصي بنجاح.'); }
    catch(err){ console.error(err); showNotice('تعذر الحفظ','تأكد من قواعد Firestore.'); }
    finally { btn.disabled=false; btn.textContent='حفظ التغييرات'; }
  });
}

function fillProfile() {
  if (!$('#profileForm') || !state.user) return;
  $('#profileAvatar').src = state.user.photoURL || fallbackAvatar;
  $('#profileDisplayName').textContent = state.profile?.name || state.user.displayName || 'مستخدم';
  $('#profileDisplayEmail').textContent = state.user.email || '';
  $('#profileName').value = state.profile?.name || state.user.displayName || '';
  $('#profileCollege').value = state.profile?.college || '';
  $('#profileMajor').value = state.profile?.major || '';
  $('#profileBio').value = state.profile?.bio || '';
  $('#metaCollege').textContent = state.profile?.college || 'لم تُحدّد الكلية';
  $('#metaMajor').textContent = state.profile?.major || 'لم يُحدّد التخصص';
  $('#loginWall')?.setAttribute('hidden','');
  $('#profileContent')?.removeAttribute('hidden');
}

function initUI() {
  $('#googleLogin')?.addEventListener('click', async () => {
    try { await signInWithPopup(auth,googleProvider); }
    catch(err) { console.error(err); showNotice('تعذر تسجيل الدخول', err.code === 'auth/unauthorized-domain' ? 'أضف نطاق GitHub Pages في Authorized domains داخل Firebase.' : 'أُغلقت نافذة الدخول أو تعذر الاتصال.'); }
  });
  $('#logoutButton')?.addEventListener('click',()=>signOut(auth));
  $('#addPostBtn')?.addEventListener('click',()=>requireLogin() && $('#postDialog').showModal());
  $('#addOpinionBtn')?.addEventListener('click',()=>requireLogin() && $('#opinionDialog').showModal());
  $('#heroAddPost')?.addEventListener('click',()=>requireLogin() && $('#postDialog').showModal());
  $('#searchInput')?.addEventListener('input',renderPosts);
  $('#opinionSearch')?.addEventListener('input',renderOpinions);
  $('#themeToggle')?.addEventListener('click',()=>{document.body.classList.toggle('dark');localStorage.setItem('theme',document.body.classList.contains('dark')?'dark':'light');$('#themeToggle').textContent=document.body.classList.contains('dark')?'☀':'☾';});
  if(localStorage.getItem('theme')==='dark'){document.body.classList.add('dark');if($('#themeToggle'))$('#themeToggle').textContent='☀';}
  $$('[data-close]').forEach(btn=>btn.onclick=()=>document.getElementById(btn.dataset.close)?.close());
}

initUI(); initForms();
onAuthStateChanged(auth, async user => {
  state.user=user;
  if(user){await ensureUser(user); updateAuthUI(); fillProfile(); startPosts(); startOpinions();}
  else{state.profile=null;updateAuthUI(); if($('#profileContent')){$('#profileContent').hidden=true;$('#loginWall').hidden=false;} if($('#feed'))$('#feed').innerHTML='<p class="empty">سجّل الدخول لعرض الملفات.</p>';}
});
