import { auth, db, googleProvider } from './firebase-config.js';
import { signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { addDoc, collection, deleteDoc, doc, getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const state = { user:null, profile:null, posts:[], opinions:[], collegePosts:[], ratings:{}, reportedPostIds:new Set(), favoritePostIds:new Set(), unsubscribe:null, opinionsUnsubscribe:null, collegeUnsubscribe:null, ratingsUnsubscribe:null, reportsUnsubscribe:null, favoritesUnsubscribe:null };
const fallbackAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Crect width='120' height='120' rx='60' fill='%236258e8'/%3E%3Ctext x='60' y='76' text-anchor='middle' font-size='52'%3E👤%3C/text%3E%3C/svg%3E";

function normalizeSearch(value=''){return String(value).toLowerCase().replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[^a-z0-9؀-ۿ]/g,'');}
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
  await setDoc(doc(db,'publicProfiles',user.uid),{uid:user.uid,name:data.name,photoURL:data.photoURL,college:data.college,major:data.major,updatedAt:serverTimestamp()},{merge:true});
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
    renderFavoritePosts();
  }, err => {
    console.error(err);
    $('#feed').innerHTML = '<p class="empty">تعذر تحميل الملفات. تأكد من نشر قواعد Firestore الصحيحة.</p>';
  });
}

function startFeedbackData() {
  if (!state.user) return;
  state.ratingsUnsubscribe?.();
  state.reportsUnsubscribe?.();
  state.ratingsUnsubscribe = onSnapshot(query(collection(db,'ratings'),where('uid','==',state.user.uid)), snap => {
    state.ratings = Object.fromEntries(snap.docs.map(item => [item.data().postId, item.data().value]));
    renderPosts();
  }, err => console.error('ratings',err));
  state.reportsUnsubscribe = onSnapshot(query(collection(db,'reports'),where('uid','==',state.user.uid)), snap => {
    state.reportedPostIds = new Set(snap.docs.map(item => item.data().postId));
    renderPosts();
  }, err => console.error('reports',err));
  state.favoritesUnsubscribe = onSnapshot(query(collection(db,'favorites'),where('uid','==',state.user.uid)), snap => {
    state.favoritePostIds = new Set(snap.docs.map(item => item.data().postId));
    renderPosts();
    renderFavoritePosts();
  }, err => console.error('favorites',err));
}

function feedbackMarkup(post) {
  if (post.uid === state.user?.uid) return '';
  const rating = Number(state.ratings[post.id] || 0);
  const reported = state.reportedPostIds.has(post.id);
  return `<div class="resource-feedback">
    <span>هل كان هذا الملخص مفيدًا؟</span>
    <div class="feedback-actions">
      <button class="feedback-btn${rating === 1 ? ' is-selected' : ''}" type="button" data-rate-post="${post.id}" data-rate-value="1" aria-pressed="${rating === 1}">👍 مفيد</button>
      <button class="feedback-btn${rating === -1 ? ' is-selected negative' : ''}" type="button" data-rate-post="${post.id}" data-rate-value="-1" aria-pressed="${rating === -1}">👎 يحتاج تحسين</button>
      <button class="report-btn" type="button" data-report-post="${post.id}" ${reported ? 'disabled' : ''}>${reported ? 'تم الإبلاغ' : 'إبلاغ'}</button>
    </div>
  </div>`;
}

async function ratePost(button) {
  if (!requireLogin()) return;
  const postId = button.dataset.ratePost;
  const post = state.posts.find(item => item.id === postId);
  const value = Number(button.dataset.rateValue);
  if (!post || post.uid === state.user.uid || ![1,-1].includes(value)) return;
  button.disabled = true;
  try {
    await setDoc(doc(db,'ratings',`${postId}_${state.user.uid}`), { postId, uid:state.user.uid, value, updatedAt:serverTimestamp() }, { merge:true });
  } catch (err) {
    console.error(err);
    showNotice('تعذر حفظ التقييم','تعذر حفظ تقييمك الآن. حاول مرة أخرى.');
  } finally { button.disabled = false; }
}

async function toggleFavorite(button) {
  if (!requireLogin()) return;
  const postId = button.dataset.favoritePost;
  const post = state.posts.find(item => item.id === postId);
  if (!post) return;
  const favoriteRef = doc(db,'favorites',`${postId}_${state.user.uid}`);
  button.disabled = true;
  try {
    if (state.favoritePostIds.has(postId)) await deleteDoc(favoriteRef);
    else await setDoc(favoriteRef,{postId,uid:state.user.uid,createdAt:serverTimestamp()});
  } catch (err) {
    console.error(err);
    showNotice('تعذر تحديث المحفوظات','تعذر حفظ هذا الملخص الآن. حاول مرة أخرى.');
  } finally { button.disabled = false; }
}

function ensureReportDialog() {
  if ($('#reportDialog')) return;
  document.body.insertAdjacentHTML('beforeend', `<dialog id="reportDialog"><form id="reportForm" class="modal"><button type="button" class="close" data-close="reportDialog">×</button><span class="eyebrow">مساعدة المجتمع</span><h2>الإبلاغ عن ملخص</h2><p class="tip">سيصل البلاغ إلى إدارة المنصة للمراجعة، ولن يظهر اسمك لصاحب المنشور.</p><label class="field">سبب البلاغ<select id="reportReason" required><option value="">اختر السبب</option><option>رابط لا يعمل</option><option>محتوى مكرر</option><option>معلومات غير صحيحة</option><option>محتوى غير مناسب</option></select></label><label class="field">ملاحظات إضافية (اختياري)<textarea id="reportDetails" maxlength="500" placeholder="اشرح المشكلة باختصار"></textarea></label><button id="submitReport" class="primary-btn full" type="submit">إرسال البلاغ</button></form></dialog>`);
  $('#reportDialog [data-close]')?.addEventListener('click', () => $('#reportDialog').close());
  $('#reportForm')?.addEventListener('submit', submitReport);
}

function openReportDialog(postId) {
  if (!requireLogin()) return;
  if (state.reportedPostIds.has(postId)) { showNotice('تم الإبلاغ سابقًا','أرسلت بلاغًا عن هذا الملخص بالفعل.'); return; }
  ensureReportDialog();
  $('#reportForm').dataset.postId = postId;
  $('#reportForm').reset();
  $('#reportDialog').showModal();
}

async function submitReport(event) {
  event.preventDefault();
  if (!requireLogin()) return;
  const form = event.currentTarget;
  const postId = form.dataset.postId;
  const reason = $('#reportReason').value;
  const details = $('#reportDetails').value.trim();
  if (!postId || !reason) return;
  const reportRef = doc(db,'reports',`${postId}_${state.user.uid}`);
  const existing = await getDoc(reportRef);
  if (existing.exists()) { $('#reportDialog').close(); showNotice('تم الإبلاغ سابقًا','شكرًا لحرصك، البلاغ مسجل بالفعل.'); return; }
  const button = $('#submitReport'); button.disabled = true; button.textContent = 'جارٍ الإرسال…';
  try {
    await setDoc(reportRef, { postId, uid:state.user.uid, reason, details, status:'جديد', createdAt:serverTimestamp() });
    $('#reportDialog').close();
    showNotice('وصل البلاغ','شكرًا لمساعدتك في تحسين جودة المحتوى.');
  } catch (err) {
    console.error(err);
    showNotice('تعذر الإرسال','تعذر إرسال البلاغ الآن. حاول مرة أخرى.');
  } finally { button.disabled = false; button.textContent = 'إرسال البلاغ'; }
}

function renderPosts() {
  const feed = $('#feed'); if (!feed) return;
  const pageCategory = document.body.dataset.category || '';
  const term = ($('#searchInput')?.value || '').trim().toLowerCase();
  let posts = state.posts.filter(p => !pageCategory || p.category === pageCategory);
  if (document.body.dataset.page === 'profile') posts = posts.filter(p => p.uid === state.user?.uid);
  if(term){const n=normalizeSearch(term);posts=posts.filter(p=>normalizeSearch(`${p.title||''} ${p.course||''} ${p.college||''} ${p.description||''} ${p.userName||''}`).includes(n));}
  if (!posts.length) { feed.innerHTML = '<p class="empty">لا توجد ملفات في هذا القسم حاليًا.</p>'; return; }
  feed.innerHTML = posts.map(p => `<article class="resource-card">
    <div class="resource-top"><span class="pill">${escapeHTML(p.category || 'ملف')}</span><span>${formatDate(p.createdAt)}</span></div>
    <p class="course">${escapeHTML(p.course || '')}${p.college ? ` · ${escapeHTML(p.college)}` : ''}</p>
    <h3>${escapeHTML(p.title || '')}</h3>
    <p class="description">${escapeHTML(p.description || '')}</p>
    <div class="author"><img class="avatar" src="${escapeHTML(p.userPhoto || fallbackAvatar)}" alt=""><div><strong>${escapeHTML(p.userName || 'مستخدم')}</strong><small>${escapeHTML(p.userCollege || '')}</small></div></div>
    <div class="resource-actions"><a class="open-link" href="${escapeHTML(p.driveUrl || '#')}" target="_blank" rel="noopener noreferrer">فتح رابط Google Drive</a>${p.uid !== state.user?.uid ? `<button class="save-btn${state.favoritePostIds.has(p.id) ? ' is-saved' : ''}" type="button" data-favorite-post="${p.id}" aria-pressed="${state.favoritePostIds.has(p.id)}">${state.favoritePostIds.has(p.id) ? '★ محفوظ' : '☆ حفظ'}</button>` : ''}${p.uid === state.user?.uid ? `<button class="danger-btn" data-delete="${p.id}">حذف</button>` : ''}</div>
    ${feedbackMarkup(p)}
  </article>`).join('');
  $$('[data-delete]').forEach(btn => btn.onclick = async () => {
    if (!confirm('هل تريد حذف هذا الملف؟')) return;
    try { await deleteDoc(doc(db,'posts',btn.dataset.delete)); }
    catch(e) { console.error(e); showNotice('تعذر الحذف','لا يمكنك حذف ملف لا تملكه.'); }
  });
  $$('[data-rate-post]').forEach(btn => btn.onclick = () => ratePost(btn));
  $$('[data-report-post]').forEach(btn => btn.onclick = () => openReportDialog(btn.dataset.reportPost));
  $$('[data-favorite-post]').forEach(btn => btn.onclick = () => toggleFavorite(btn));
}

function renderFavoritePosts() {
  const feed = $('#favoritesFeed');
  if (!feed) return;
  const posts = state.posts.filter(post => state.favoritePostIds.has(post.id));
  if (!posts.length) { feed.innerHTML = '<p class="empty">لم تحفظ أي ملخص بعد. استخدم زر «حفظ» داخل أي ملخص للعودة إليه بسرعة.</p>'; return; }
  feed.innerHTML = posts.map(post => `<article class="resource-card"><div class="resource-top"><span class="pill">محفوظ</span><span>${formatDate(post.createdAt)}</span></div><p class="course">${escapeHTML(post.course || '')}${post.college ? ` · ${escapeHTML(post.college)}` : ''}</p><h3>${escapeHTML(post.title || '')}</h3><p class="description">${escapeHTML(post.description || '')}</p><div class="resource-actions"><a class="open-link" href="${escapeHTML(post.driveUrl || '#')}" target="_blank" rel="noopener noreferrer">فتح الملف</a><button class="save-btn is-saved" type="button" data-favorite-post="${post.id}" aria-pressed="true">★ محفوظ</button></div></article>`).join('');
  $$('[data-favorite-post]').forEach(btn => btn.onclick = () => toggleFavorite(btn));
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
  if(term){const n=normalizeSearch(term);items=items.filter(o=>normalizeSearch(`${o.course||''} ${o.code||''} ${o.college||''} ${o.text||''}`).includes(n));}
  if(!items.length){feed.innerHTML='<p class="empty">لا توجد آراء منشورة حاليًا.</p>';return;}
  feed.innerHTML=items.map(o=>{const avg=((Number(o.ratingEase||0)+Number(o.ratingExams||0)+Number(o.ratingWorkload||0)+Number(o.ratingContent||0))/4).toFixed(1);return `<article class="resource-card opinion-card"><div class="resource-top"><span class="pill">${escapeHTML(o.college||'كلية')}</span><span>${formatDate(o.createdAt)}</span></div><p class="course">${escapeHTML(o.code||'')}</p><h3>${escapeHTML(o.course||'')}</h3><div class="rating-summary"><strong>⭐ ${avg}/5</strong><span>السهولة ${o.ratingEase||'-'} · الاختبارات ${o.ratingExams||'-'} · الواجبات ${o.ratingWorkload||'-'} · المحتوى ${o.ratingContent||'-'}</span></div><p class="description">${escapeHTML(o.text||'')}</p><div class="author"><img class="avatar" src="${escapeHTML(o.userPhoto||fallbackAvatar)}" alt=""><div><strong>${escapeHTML(o.userName||'طالب')}</strong><small>رأي طالب</small></div></div>${o.uid===state.user?.uid?`<button class="danger-btn opinion-delete" data-opinion-delete="${o.id}">حذف رأيي</button>`:''}</article>`}).join('');
  $$('[data-opinion-delete]').forEach(btn=>btn.onclick=async()=>{if(confirm('هل تريد حذف هذا الرأي؟')) await deleteDoc(doc(db,'opinions',btn.dataset.opinionDelete));});
}

function initForms() {
  $('#opinionForm')?.addEventListener('submit', async e => {
    e.preventDefault(); if(!requireLogin()) return;
    const btn=$('#publishOpinion'); btn.disabled=true; btn.textContent='جارٍ النشر…';
    try { await addDoc(collection(db,'opinions'),{uid:state.user.uid,userName:state.profile?.name||state.user.displayName||'طالب',userPhoto:state.user.photoURL||'',course:$('#opinionCourse').value.trim(),code:$('#opinionCode').value.trim(),college:$('#opinionCollege').value,text:$('#opinionText').value.trim(),ratingEase:Number($('#ratingEase').value),ratingExams:Number($('#ratingExams').value),ratingWorkload:Number($('#ratingWorkload').value),ratingContent:Number($('#ratingContent').value),createdAt:serverTimestamp()}); e.target.reset(); $('#opinionDialog').close(); }
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
    try { await setDoc(doc(db,'users',state.user.uid),profile,{merge:true}); await setDoc(doc(db,'publicProfiles',state.user.uid),{uid:state.user.uid,name:profile.name,photoURL:profile.photoURL,college:profile.college,major:profile.major,updatedAt:serverTimestamp()},{merge:true}); state.profile={...state.profile,...profile}; fillProfile(); updateAuthUI(); showNotice('تم الحفظ','تم تحديث ملفك الشخصي بنجاح.'); }
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

function applyTheme(theme, persist = false) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark', isDark);
  const toggle = $('#themeToggle');
  if (toggle) {
    toggle.textContent = isDark ? '☀' : '☾';
    toggle.setAttribute('aria-pressed', String(isDark));
    toggle.setAttribute('aria-label', isDark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن');
    toggle.title = isDark ? 'الوضع الفاتح' : 'الوضع الداكن';
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#090e1b' : '#6258e8');
  if (persist) localStorage.setItem('theme', theme);
}

function initTheme() {
  const saved = localStorage.getItem('theme');
  const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (systemDark ? 'dark' : 'light'));
  $('#themeToggle')?.addEventListener('click', () => applyTheme(document.body.classList.contains('dark') ? 'light' : 'dark', true));
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', event => {
    if (!localStorage.getItem('theme')) applyTheme(event.matches ? 'dark' : 'light');
  });
}

function initUI() {
  const nav = $('.nav');
  if (nav && !nav.querySelector('[data-social-link]')) {
    nav.insertAdjacentHTML('beforeend','<a data-social-link href="stories.html">القصص</a><a data-social-link href="messages.html">الرسائل</a>');
    nav.querySelectorAll('[data-social-link]').forEach(link => { if (link.getAttribute('href') === location.pathname.split('/').pop()) link.classList.add('active'); });
  }
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
  $$('[data-close]').forEach(btn=>btn.onclick=()=>document.getElementById(btn.dataset.close)?.close());
}

initTheme(); initUI(); initForms(); initCollegeSearch(); initCollegePage();
onAuthStateChanged(auth, async user => {
  state.user=user;
  if(user){await ensureUser(user);updateAuthUI();fillProfile();startFeedbackData();startPosts();startOpinions();startCollegePosts();}
  else{state.profile=null;state.posts=[];state.opinions=[];state.collegePosts=[];state.ratings={};state.reportedPostIds=new Set();state.favoritePostIds=new Set();state.unsubscribe?.();state.opinionsUnsubscribe?.();state.collegeUnsubscribe?.();state.ratingsUnsubscribe?.();state.reportsUnsubscribe?.();state.favoritesUnsubscribe?.();updateAuthUI(); if($('#profileContent')){$('#profileContent').hidden=true;$('#loginWall').hidden=false;} if($('#feed'))$('#feed').innerHTML='<p class="empty">سجّل الدخول لعرض الملفات.</p>';if($('#favoritesFeed'))$('#favoritesFeed').innerHTML='<p class="empty">سجّل الدخول لعرض محفوظاتك.</p>';if($('#opinionsFeed'))$('#opinionsFeed').innerHTML='<p class="empty">سجّل الدخول لعرض الآراء.</p>';if($('#communityFeed'))$('#communityFeed').innerHTML='<p class="empty">سجّل الدخول لعرض مجتمع الكلية.</p>';}
});

function initCollegeSearch(){const input=$('#collegeSearch');if(!input)return;input.addEventListener('input',()=>{const n=normalizeSearch(input.value);$$('.college-card').forEach(card=>card.hidden=n&&!normalizeSearch(card.textContent).includes(n));});}
function collegeName(){return new URLSearchParams(location.search).get('name')||'';}
function initCollegePage(){if(document.body.dataset.page!=='college')return;const name=collegeName();$('#collegeTitle').textContent=name||'الكلية';$$('[data-tab]').forEach(btn=>btn.onclick=()=>{$$('[data-tab]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');['community','news','resources'].forEach(x=>$('#'+x+'Tab').hidden=x!==btn.dataset.tab);if(btn.dataset.tab==='resources')renderCollegeResources();});$('#addCommunityBtn')?.addEventListener('click',()=>openCollegePost('community'));$('#addNewsBtn')?.addEventListener('click',()=>openCollegePost('news'));$('#collegeResourceSearch')?.addEventListener('input',renderCollegeResources);$('#collegePostForm')?.addEventListener('submit',publishCollegePost);}
function openCollegePost(type){if(!requireLogin())return;$('#collegePostType').value=type;$('#collegePostTitle').textContent=type==='news'?'إضافة خبر':'إضافة منشور للمجتمع';$('#collegePostCategory').value=type==='news'?'خبر':'سؤال';$('#collegePostDialog').showModal();}
async function publishCollegePost(e){e.preventDefault();if(!requireLogin())return;const btn=$('#publishCollegePost');btn.disabled=true;try{await addDoc(collection(db,'collegePosts'),{uid:state.user.uid,userName:state.profile?.name||state.user.displayName||'طالب',userPhoto:state.user.photoURL||'',college:collegeName(),type:$('#collegePostType').value,category:$('#collegePostCategory').value,heading:$('#collegePostHeading').value.trim(),text:$('#collegePostText').value.trim(),createdAt:serverTimestamp()});e.target.reset();$('#collegePostDialog').close();}catch(err){console.error(err);showNotice('تعذر النشر','تأكد من نشر قواعد Firestore الجديدة.');}finally{btn.disabled=false;}}
function startCollegePosts(){if(!$('#communityFeed'))return;state.collegeUnsubscribe?.();state.collegeUnsubscribe=onSnapshot(query(collection(db,'collegePosts'),orderBy('createdAt','desc'),limit(300)),snap=>{state.collegePosts=snap.docs.map(d=>({id:d.id,...d.data()}));renderCollegePosts();renderCollegeResources();},err=>{console.error(err);$('#communityFeed').innerHTML='<p class="empty">تعذر تحميل مجتمع الكلية.</p>';});}
function renderCollegePosts(){const name=collegeName();['community','news'].forEach(type=>{const feed=$('#'+type+'Feed');if(!feed)return;const items=state.collegePosts.filter(p=>p.college===name&&p.type===type);feed.innerHTML=items.length?items.map(p=>`<article class="resource-card"><div class="resource-top"><span class="pill">${escapeHTML(p.category||'منشور')}</span><span>${formatDate(p.createdAt)}</span></div><h3>${escapeHTML(p.heading||'')}</h3><p class="description">${escapeHTML(p.text||'')}</p><div class="author"><img class="avatar" src="${escapeHTML(p.userPhoto||fallbackAvatar)}"><div><strong>${escapeHTML(p.userName||'طالب')}</strong><small>${escapeHTML(p.college||'')}</small></div></div>${p.uid===state.user?.uid?`<button class="danger-btn" data-college-delete="${p.id}">حذف</button>`:''}</article>`).join(''):'<p class="empty">لا توجد منشورات بعد.</p>';});$$('[data-college-delete]').forEach(btn=>btn.onclick=async()=>{if(confirm('حذف هذا المنشور؟'))await deleteDoc(doc(db,'collegePosts',btn.dataset.collegeDelete));});}
function renderCollegeResources(){const box=$('#collegeResources');if(!box)return;const name=collegeName(),n=normalizeSearch($('#collegeResourceSearch')?.value||'');const posts=state.posts.filter(p=>p.college===name&&(!n||normalizeSearch(`${p.title} ${p.course} ${p.description}`).includes(n)));const opinions=state.opinions.filter(o=>o.college===name&&(!n||normalizeSearch(`${o.course} ${o.code} ${o.text}`).includes(n)));const cards=[...posts.map(p=>`<article class="resource-card"><span class="pill">${escapeHTML(p.category||'ملف')}</span><h3>${escapeHTML(p.title||'')}</h3><p class="course">${escapeHTML(p.course||'')}</p><a class="open-link" href="${escapeHTML(p.driveUrl||'#')}" target="_blank">فتح الملف</a></article>`),...opinions.map(o=>`<article class="resource-card"><span class="pill">رأي طالب</span><h3>${escapeHTML(o.course||'')}</h3><p class="course">${escapeHTML(o.code||'')}</p><p class="description">${escapeHTML(o.text||'')}</p></article>`)];box.innerHTML=cards.length?cards.join(''):'<p class="empty">لا توجد موارد مرتبطة بهذه الكلية حاليًا.</p>';}
