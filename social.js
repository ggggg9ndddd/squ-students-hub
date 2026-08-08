import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { Timestamp, collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, where, writeBatch } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { getDownloadURL, ref, uploadBytes } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const fallbackAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Crect width='120' height='120' rx='60' fill='%236258e8'/%3E%3Ctext x='60' y='76' text-anchor='middle' font-size='52'%3E👤%3C/text%3E%3C/svg%3E";
const social = { user:null, profiles:new Map(), conversations:[], selectedConversation:null, stories:[], conversationsUnsubscribe:null, messagesUnsubscribe:null, storiesUnsubscribe:null };

function escapeHTML(value='') { return String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char])); }
function showNotice(title,text) { if (!$('#noticeDialog')) return alert(text); $('#noticeTitle').textContent=title; $('#noticeText').textContent=text; $('#noticeDialog').showModal(); }
function formatTime(timestamp) { return timestamp?.toDate ? new Intl.DateTimeFormat('ar-OM',{hour:'numeric',minute:'2-digit'}).format(timestamp.toDate()) : 'الآن'; }
function displayProfile(uid) { return social.profiles.get(uid) || { uid, name:'طالب', photoURL:'', college:'' }; }
function currentProfile() { return { uid:social.user.uid, name:social.user.displayName || 'طالب', photoURL:social.user.photoURL || '', college:'' }; }
function showSocialApp() { $('#socialLoginWall')?.setAttribute('hidden',''); $('#messagesApp')?.removeAttribute('hidden'); $('#storiesApp')?.removeAttribute('hidden'); }
function hideSocialApp() { $('#socialLoginWall')?.removeAttribute('hidden'); $('#messagesApp')?.setAttribute('hidden',''); $('#storiesApp')?.setAttribute('hidden'); }

async function loadProfiles() {
  const snapshot = await getDocs(query(collection(db,'publicProfiles'),limit(100)));
  social.profiles = new Map(snapshot.docs.map(item => [item.id,{uid:item.id,...item.data()}]));
  if (social.user && !social.profiles.has(social.user.uid)) social.profiles.set(social.user.uid,currentProfile());
  renderPeople(); renderConversations();
}

function initMessagesPage() {
  if (!$('#messagesApp')) return;
  $('#peopleSearch')?.addEventListener('input',renderPeople);
  $('#messageForm')?.addEventListener('submit',sendMessage);
}

function renderPeople() {
  const box=$('#peopleResults'); if(!box || !social.user) return;
  const term=($('#peopleSearch')?.value || '').trim().toLowerCase();
  const people=[...social.profiles.values()].filter(person => person.uid !== social.user.uid && `${person.name||''} ${person.college||''}`.toLowerCase().includes(term));
  box.innerHTML=people.length ? people.slice(0,20).map(person => `<button class="person-row" type="button" data-person-id="${person.uid}"><img src="${escapeHTML(person.photoURL||fallbackAvatar)}" alt=""><div><strong>${escapeHTML(person.name||'طالب')}</strong><small>${escapeHTML(person.college||'طالب في أنجز')}</small></div></button>`).join('') : `<p class="empty">${term ? 'لا توجد نتائج مطابقة.' : 'ابحث عن طالب لبدء محادثة.'}</p>`;
  $$('[data-person-id]').forEach(button => button.onclick=()=>startConversation(displayProfile(button.dataset.personId)));
}

function conversationIdFor(uid) { return [social.user.uid,uid].sort().join('_'); }
async function startConversation(person) {
  if (!social.user || person.uid === social.user.uid) return;
  const id=conversationIdFor(person.uid);
  const ref=doc(db,'conversations',id);
  const existing=await getDoc(ref);
  if (!existing.exists()) {
    const members=[social.user.uid,person.uid].sort();
    const profiles=[currentProfile(),person];
    await setDoc(ref,{members,memberNames:members.map(uid=>profiles.find(profile=>profile.uid===uid)?.name||'طالب'),lastMessage:'',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  }
  social.selectedConversation={id,members:[social.user.uid,person.uid].sort(),person};
  renderConversations(); openConversation(social.selectedConversation);
}

function startConversations() {
  if (!$('#messagesApp') || !social.user) return;
  social.conversationsUnsubscribe?.();
  social.conversationsUnsubscribe=onSnapshot(query(collection(db,'conversations'),where('members','array-contains',social.user.uid),limit(100)),snapshot=>{
    social.conversations=snapshot.docs.map(item=>({id:item.id,...item.data()})).sort((a,b)=>(b.updatedAt?.seconds||0)-(a.updatedAt?.seconds||0));
    renderConversations();
  },error=>{console.error(error);$('#conversationsList').innerHTML='<p class="empty">تعذر تحميل المحادثات.</p>';});
}

function conversationPerson(conversation) {
  const uid=conversation.members.find(member=>member!==social.user.uid);
  const profile=displayProfile(uid);
  const index=conversation.members.indexOf(uid);
  return {...profile,name:conversation.memberNames?.[index] || profile.name};
}

function renderConversations() {
  const box=$('#conversationsList'); if(!box || !social.user) return;
  box.innerHTML=social.conversations.length ? social.conversations.map(conversation=>{const person=conversationPerson(conversation);return `<button class="conversation-row${social.selectedConversation?.id===conversation.id?' is-active':''}" type="button" data-conversation-id="${conversation.id}"><img src="${escapeHTML(person.photoURL||fallbackAvatar)}" alt=""><div><strong>${escapeHTML(person.name||'طالب')}</strong><small>${escapeHTML(conversation.lastMessage||'ابدأ المحادثة')}</small></div></button>`;}).join(''):'<p class="empty">لا توجد محادثات بعد.</p>';
  $$('[data-conversation-id]').forEach(button=>button.onclick=()=>{const conversation=social.conversations.find(item=>item.id===button.dataset.conversationId);if(conversation)openConversation({...conversation,person:conversationPerson(conversation)});});
}

function openConversation(conversation) {
  social.selectedConversation=conversation;
  $('#chatEmpty')?.setAttribute('hidden',''); $('#chatContent')?.removeAttribute('hidden');
  const person=conversation.person || conversationPerson(conversation);
  $('#chatAvatar').src=person.photoURL||fallbackAvatar; $('#chatName').textContent=person.name||'طالب'; $('#chatCollege').textContent=person.college||'طالب في أنجز';
  renderConversations(); subscribeMessages(conversation.id);
}

function subscribeMessages(conversationId) {
  social.messagesUnsubscribe?.();
  social.messagesUnsubscribe=onSnapshot(query(collection(db,'conversations',conversationId,'messages'),orderBy('createdAt','asc'),limit(100)),snapshot=>{
    const list=$('#messagesList'); if(!list) return;
    list.innerHTML=snapshot.docs.length ? snapshot.docs.map(item=>{const message=item.data(),mine=message.uid===social.user.uid;return `<article class="message-bubble${mine?' mine':''}">${escapeHTML(message.text)}<small>${formatTime(message.createdAt)}</small></article>`;}).join(''):'<p class="empty">ابدأ المحادثة برسالة لطيفة.</p>';
    list.scrollTop=list.scrollHeight;
  },error=>{console.error(error);$('#messagesList').innerHTML='<p class="empty">تعذر تحميل الرسائل.</p>';});
}

async function sendMessage(event) {
  event.preventDefault();
  if (!social.user || !social.selectedConversation) return;
  const text=$('#messageText').value.trim(); if(!text) return;
  const button=$('#sendMessage'); button.disabled=true;
  try {
    const conversationRef=doc(db,'conversations',social.selectedConversation.id);
    const messageRef=doc(collection(db,'conversations',social.selectedConversation.id,'messages'));
    const batch=writeBatch(db);
    batch.set(messageRef,{uid:social.user.uid,text,createdAt:serverTimestamp()});
    batch.update(conversationRef,{lastMessage:text,updatedAt:serverTimestamp()});
    await batch.commit();
    $('#messageText').value='';
  } catch(error) { console.error(error); showNotice('تعذر الإرسال','تعذر إرسال الرسالة الآن. حاول مرة أخرى.'); }
  finally { button.disabled=false; }
}

function initStoriesPage() {
  if (!$('#storiesApp')) return;
  $('#openStoryComposer')?.addEventListener('click',()=>$('#storyComposer').showModal());
  $('#storyForm')?.addEventListener('submit',publishStory);
  $$('[data-close]').forEach(button=>button.addEventListener('click',()=>document.getElementById(button.dataset.close)?.close()));
}

function startStories() {
  if (!$('#storiesApp') || !social.user) return;
  social.storiesUnsubscribe?.();
  social.storiesUnsubscribe=onSnapshot(query(collection(db,'stories'),where('expiresAt','>',Timestamp.now()),limit(100)),snapshot=>{
    social.stories=snapshot.docs.map(item=>({id:item.id,...item.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    renderStories();
  },error=>{console.error(error);$('#storiesFeed').innerHTML='<p class="empty">تعذر تحميل القصص.</p>';});
}

function renderStories() {
  const feed=$('#storiesFeed'); if(!feed) return;
  feed.innerHTML=social.stories.length ? social.stories.map(story=>{const image=story.imageUrl?` style="background-image:url('${escapeHTML(story.imageUrl)}')"`:'';return `<button class="story-card story-${escapeHTML(story.background||'violet')}${story.imageUrl?' has-image':''}" type="button" data-story-id="${story.id}"${image}><div class="story-author"><img src="${escapeHTML(story.userPhoto||fallbackAvatar)}" alt=""><div><strong>${escapeHTML(story.userName||'طالب')}</strong><small>${story.uid===social.user.uid?'قصتك':'قصة طالب'}</small></div></div><p>${escapeHTML(story.text||'صورة جديدة')}</p></button>`;}).join(''):'<p class="empty">لا توجد قصص حاليًا. كن أول من يشارك شيئًا مفيدًا.</p>';
  $$('[data-story-id]').forEach(button=>button.onclick=()=>viewStory(button.dataset.storyId));
}

function viewStory(storyId) {
  const story=social.stories.find(item=>item.id===storyId); if(!story) return;
  const content=$('#storyViewContent');
  content.className=`story-view-content story-${story.background||'violet'}`;
  content.style.backgroundImage=story.imageUrl?`url("${story.imageUrl}")`:'';
  content.innerHTML=`<div class="story-author"><img src="${escapeHTML(story.userPhoto||fallbackAvatar)}" alt=""><div><strong>${escapeHTML(story.userName||'طالب')}</strong><small>${story.uid===social.user.uid?'قصتك':'قصة طالب'}</small></div></div><p>${escapeHTML(story.text||'')}</p>`;
  $('#storyViewer').showModal();
}

async function publishStory(event) {
  event.preventDefault();
  if(!social.user) return;
  const text=$('#storyText').value.trim();
  const file=$('#storyImage').files?.[0];
  const background=$('#storyBackground').value;
  if(!text && !file) { showNotice('أضف محتوى','اكتب نصًا أو اختر صورة لقصتك.'); return; }
  if(file && (!file.type.startsWith('image/') || file.size>5*1024*1024)) { showNotice('الصورة غير مناسبة','اختر صورة بحجم لا يتجاوز 5 MB.'); return; }
  const button=$('#publishStory'); button.disabled=true; button.textContent='جارٍ النشر…';
  try {
    const storyRef=doc(collection(db,'stories'));
    let imageUrl='';
    if(file) { const fileRef=ref(storage,`stories/${social.user.uid}/${storyRef.id}/${file.name}`); await uploadBytes(fileRef,file,{contentType:file.type}); imageUrl=await getDownloadURL(fileRef); }
    await setDoc(storyRef,{uid:social.user.uid,userName:social.user.displayName||'طالب',userPhoto:social.user.photoURL||'',text,imageUrl,background,createdAt:serverTimestamp(),expiresAt:Timestamp.fromMillis(Date.now()+24*60*60*1000)});
    event.currentTarget.reset(); $('#storyComposer').close();
  } catch(error) { console.error(error); showNotice('تعذر النشر','تأكد من تفعيل Firebase Storage ونشر قواعده، ثم حاول مرة أخرى.'); }
  finally { button.disabled=false; button.textContent='نشر القصة'; }
}

initMessagesPage(); initStoriesPage();
onAuthStateChanged(auth,async user=>{
  social.user=user;
  if(!user) { hideSocialApp(); social.conversationsUnsubscribe?.(); social.messagesUnsubscribe?.(); social.storiesUnsubscribe?.(); return; }
  showSocialApp();
  try { await loadProfiles(); startConversations(); startStories(); }
  catch(error) { console.error(error); showNotice('تعذر تحميل الميزة الاجتماعية','تأكد من نشر قواعد Firebase الجديدة ثم حدّث الصفحة.'); }
});
