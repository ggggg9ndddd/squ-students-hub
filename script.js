import { auth, db, googleProvider } from "./firebase-config.js";
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDocs,
  limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const $ = (s) => document.querySelector(s);
const state = { user: null, posts: [], stories: [], activePostId: null, unsubPosts: null, unsubStories: null, unsubComments: null };
const fallbackAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' rx='50' fill='%238c5cff'/%3E%3Ctext x='50' y='62' text-anchor='middle' font-size='45'%3E👤%3C/text%3E%3C/svg%3E";

function notice(title, text){ $("#noticeTitle").textContent=title; $("#noticeText").textContent=text; $("#noticeDialog").showModal(); }
function requireLogin(){ if(!state.user){ notice("سجّل الدخول أولًا","تسجيل الدخول بحساب Google مطلوب للنشر والتعليق والإعجاب."); return false; } return true; }
function escapeHTML(value=""){ return value.replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function timeAgo(ts){ if(!ts?.toDate) return "الآن"; const seconds=Math.max(1,(Date.now()-ts.toDate().getTime())/1000); if(seconds<60)return "الآن"; if(seconds<3600)return `منذ ${Math.floor(seconds/60)} د`; if(seconds<86400)return `منذ ${Math.floor(seconds/3600)} س`; return `منذ ${Math.floor(seconds/86400)} ي`; }

async function compressImage(file, maxWidth=1080, maxHeight=1350, quality=.72){
  if(!file.type.startsWith("image/")) throw new Error("اختر صورة فقط");
  const bitmap=await createImageBitmap(file); const ratio=Math.min(1,maxWidth/bitmap.width,maxHeight/bitmap.height);
  const canvas=document.createElement("canvas"); canvas.width=Math.round(bitmap.width*ratio); canvas.height=Math.round(bitmap.height*ratio);
  canvas.getContext("2d").drawImage(bitmap,0,0,canvas.width,canvas.height);
  let q=quality, data=canvas.toDataURL("image/jpeg",q);
  while(data.length>720000 && q>.38){ q-=.08; data=canvas.toDataURL("image/jpeg",q); }
  bitmap.close();
  if(data.length>900000) throw new Error("الصورة كبيرة جدًا. اختر صورة أصغر.");
  return data;
}
function previewFile(input, target){ const file=input.files?.[0]; if(!file){target.hidden=true;return;} const url=URL.createObjectURL(file); target.style.backgroundImage=`url('${url}')`; target.hidden=false; }

async function ensureUser(user){ await setDoc(doc(db,"users",user.uid),{uid:user.uid,name:user.displayName||"مستخدم",email:user.email||"",photoURL:user.photoURL||"",lastSeen:serverTimestamp()},{merge:true}); }

function startRealtime(){
  state.unsubPosts?.(); state.unsubStories?.();
  state.unsubPosts=onSnapshot(query(collection(db,"posts"),orderBy("createdAt","desc"),limit(60)),snap=>{state.posts=snap.docs.map(d=>({id:d.id,...d.data()})); renderPosts();},err=>{console.error(err); $("#feed").innerHTML='<p class="empty">تعذر تحميل المنشورات. تأكد من نشر قواعد Firestore.</p>';});
  const cutoff=new Date(Date.now()-24*60*60*1000);
  state.unsubStories=onSnapshot(query(collection(db,"stories"),where("createdAt",">",cutoff),orderBy("createdAt","desc"),limit(80)),snap=>{state.stories=snap.docs.map(d=>({id:d.id,...d.data()})); renderStories();},err=>{console.error(err); $("#storiesRow").innerHTML='<p class="muted">تعذر تحميل القصص.</p>';});
}

function renderStories(){
  const row=$("#storiesRow");
  if(!state.stories.length){ row.innerHTML='<p class="muted">لا توجد قصص خلال آخر 24 ساعة.</p>'; return; }
  const latestByUser=[]; const seen=new Set();
  for(const story of state.stories){ if(!seen.has(story.uid)){seen.add(story.uid);latestByUser.push(story);} }
  row.innerHTML=latestByUser.map(s=>`<button class="story-item" data-story="${s.id}"><div class="story-ring"><img src="${s.userPhoto||fallbackAvatar}" alt=""></div><small>${escapeHTML((s.userName||"مستخدم").split(" ")[0])}</small></button>`).join("");
  row.querySelectorAll("[data-story]").forEach(btn=>btn.onclick=()=>openStory(btn.dataset.story));
}

async function openStory(id){
  const story=state.stories.find(s=>s.id===id); if(!story)return;
  $("#viewerAvatar").src=story.userPhoto||fallbackAvatar; $("#viewerName").textContent=story.userName||"مستخدم"; $("#viewerTime").textContent=timeAgo(story.createdAt); $("#viewerImage").src=story.imageData; $("#viewerText").textContent=story.text||"";
  const views=story.views||[]; $("#viewerViews").textContent=story.uid===state.user?.uid?`${views.length} مشاهدة`:"";
  $("#storyViewer").showModal();
  if(state.user && story.uid!==state.user.uid && !views.includes(state.user.uid)){ try{ await updateDoc(doc(db,"stories",id),{views:arrayUnion(state.user.uid)}); }catch(e){console.error(e);} }
}

function renderPosts(){
  const feed=$("#feed"); if(!state.posts.length){feed.innerHTML='<p class="empty">لا توجد منشورات بعد. كن أول من ينشر.</p>';return;}
  feed.innerHTML=state.posts.map(p=>{const likes=p.likes||[]; const liked=state.user&&likes.includes(state.user.uid); const owner=state.user?.uid===p.uid; return `<article class="post" data-post="${p.id}">
    <header class="post-header"><img class="avatar" src="${p.userPhoto||fallbackAvatar}" alt=""><div class="meta"><strong>${escapeHTML(p.userName||"مستخدم")}</strong><small>${timeAgo(p.createdAt)}</small></div>${owner?`<button class="post-menu" data-delete-post="${p.id}" title="حذف">×</button>`:""}</header>
    <img class="post-image" src="${p.imageData}" alt="منشور ${escapeHTML(p.userName||"")}" loading="lazy">
    <div class="post-actions"><button class="action-btn ${liked?"liked":""}" data-like="${p.id}">${liked?"♥":"♡"}</button><button class="action-btn" data-comments="${p.id}">💬</button></div>
    <div class="post-body"><p class="likes-count">${likes.length} إعجاب</p>${p.caption?`<p class="caption"><strong>${escapeHTML(p.userName||"مستخدم")}</strong> ${escapeHTML(p.caption)}</p>`:""}<button class="view-comments" data-comments="${p.id}">عرض التعليقات</button></div>
  </article>`}).join("");
  feed.querySelectorAll("[data-like]").forEach(b=>b.onclick=()=>toggleLike(b.dataset.like));
  feed.querySelectorAll("[data-comments]").forEach(b=>b.onclick=()=>openComments(b.dataset.comments));
  feed.querySelectorAll("[data-delete-post]").forEach(b=>b.onclick=()=>deletePost(b.dataset.deletePost));
}

async function toggleLike(id){ if(!requireLogin())return; const post=state.posts.find(p=>p.id===id); if(!post)return; const liked=(post.likes||[]).includes(state.user.uid); try{await updateDoc(doc(db,"posts",id),{likes:liked?arrayRemove(state.user.uid):arrayUnion(state.user.uid)});}catch(e){console.error(e);notice("تعذر الإعجاب","تحقق من قواعد Firestore.");} }
async function deletePost(id){ if(!confirm("هل تريد حذف المنشور؟"))return; try{await deleteDoc(doc(db,"posts",id));}catch(e){console.error(e);notice("تعذر الحذف","لا يمكنك حذف منشور لا تملكه.");} }

function openComments(postId){ if(!requireLogin())return; state.activePostId=postId; $("#commentsDialog").showModal(); $("#commentsList").innerHTML='<p class="loading">جارٍ التحميل…</p>'; state.unsubComments?.(); state.unsubComments=onSnapshot(query(collection(db,"posts",postId,"comments"),orderBy("createdAt","asc"),limit(200)),snap=>{const list=snap.docs.map(d=>({id:d.id,...d.data()})); $("#commentsList").innerHTML=list.length?list.map(c=>`<div class="comment"><img class="avatar" src="${c.userPhoto||fallbackAvatar}" alt=""><div class="comment-content"><strong>${escapeHTML(c.userName||"مستخدم")}</strong><p>${escapeHTML(c.text||"")}</p><small>${timeAgo(c.createdAt)}</small></div>${c.uid===state.user?.uid?`<button class="comment-delete" data-delete-comment="${c.id}">حذف</button>`:""}</div>`).join(""):'<p class="empty">لا توجد تعليقات بعد.</p>'; $("#commentsList").querySelectorAll("[data-delete-comment]").forEach(b=>b.onclick=()=>deleteComment(b.dataset.deleteComment));}); }
async function deleteComment(commentId){try{await deleteDoc(doc(db,"posts",state.activePostId,"comments",commentId));}catch(e){console.error(e);} }

$("#commentForm").onsubmit=async(e)=>{e.preventDefault();if(!requireLogin()||!state.activePostId)return;const input=$("#commentInput"),text=input.value.trim();if(!text)return;const btn=e.submitter;btn.disabled=true;try{await addDoc(collection(db,"posts",state.activePostId,"comments"),{text,uid:state.user.uid,userName:state.user.displayName||"مستخدم",userPhoto:state.user.photoURL||"",createdAt:serverTimestamp()});input.value="";}catch(err){console.error(err);notice("تعذر نشر التعليق","تحقق من قواعد Firestore.");}finally{btn.disabled=false;}};

$("#postForm").onsubmit=async(e)=>{e.preventDefault();if(!requireLogin())return;const file=$("#postImage").files[0],caption=$("#postCaption").value.trim(),btn=$("#publishPost");if(!file)return;btn.disabled=true;btn.textContent="جارٍ ضغط الصورة والنشر…";try{const imageData=await compressImage(file,1080,1350,.74);await addDoc(collection(db,"posts"),{uid:state.user.uid,userName:state.user.displayName||"مستخدم",userPhoto:state.user.photoURL||"",caption,imageData,likes:[],createdAt:serverTimestamp()});e.target.reset();$("#postPreview").hidden=true;$("#postDialog").close();}catch(err){console.error(err);notice("تعذر نشر المنشور",err.message||"حاول مرة أخرى.");}finally{btn.disabled=false;btn.textContent="نشر";}};

$("#storyForm").onsubmit=async(e)=>{e.preventDefault();if(!requireLogin())return;const file=$("#storyImage").files[0],text=$("#storyText").value.trim(),btn=$("#publishStory");if(!file)return;btn.disabled=true;btn.textContent="جارٍ النشر…";try{const imageData=await compressImage(file,900,1600,.7);await addDoc(collection(db,"stories"),{uid:state.user.uid,userName:state.user.displayName||"مستخدم",userPhoto:state.user.photoURL||"",text,imageData,views:[],createdAt:serverTimestamp()});e.target.reset();$("#storyPreview").hidden=true;$("#storyDialog").close();}catch(err){console.error(err);notice("تعذر نشر القصة",err.message||"حاول مرة أخرى.");}finally{btn.disabled=false;btn.textContent="نشر القصة";}};

$("#googleLogin").onclick=async()=>{const b=$("#googleLogin");b.disabled=true;try{await signInWithPopup(auth,googleProvider);}catch(e){console.error(e);notice("تعذر تسجيل الدخول",e.code==="auth/unauthorized-domain"?"أضف نطاق GitHub Pages في Authorized domains داخل Firebase.":"أُغلقت النافذة أو تعذر الاتصال.");}finally{b.disabled=false;}};
$("#logoutButton").onclick=()=>signOut(auth);
onAuthStateChanged(auth,async user=>{state.user=user;if(user){await ensureUser(user);$("#googleLogin").hidden=true;$("#userMenu").hidden=false;$("#userName").textContent=user.displayName||"مستخدم";$("#userEmail").textContent=user.email||"";$("#userPhoto").src=user.photoURL||fallbackAvatar;$("#composerAvatar").src=user.photoURL||fallbackAvatar;startRealtime();}else{$("#googleLogin").hidden=false;$("#userMenu").hidden=true;$("#composerAvatar").src=fallbackAvatar;state.posts=[];state.stories=[];state.unsubPosts?.();state.unsubStories?.();$("#feed").innerHTML='<p class="empty">سجّل الدخول لمشاهدة المنشورات والمشاركة.</p>';$("#storiesRow").innerHTML='<p class="muted">سجّل الدخول لمشاهدة القصص.</p>';}});

function openPost(){if(requireLogin())$("#postDialog").showModal();} function openStoryComposer(){if(requireLogin())$("#storyDialog").showModal();}
$("#openPostComposer").onclick=openPost;$("#bottomAddPost").onclick=openPost;$("#addStoryBtn").onclick=openStoryComposer;$("#profileBtn").onclick=()=>{if(!requireLogin())return;notice("حسابك",`${state.user.displayName||"مستخدم"}\n${state.user.email||""}`);};
$("#postImage").onchange=()=>previewFile($("#postImage"),$("#postPreview"));$("#storyImage").onchange=()=>previewFile($("#storyImage"),$("#storyPreview"));
$("#themeToggle").onclick=()=>{document.body.classList.toggle("light");$("#themeToggle").textContent=document.body.classList.contains("light")?"☀":"☾";localStorage.setItem("theme",document.body.classList.contains("light")?"light":"dark");};if(localStorage.getItem("theme")==="light")document.body.classList.add("light");
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>document.getElementById(b.dataset.close).close());document.querySelector('[data-go="top"]').onclick=()=>scrollTo({top:0,behavior:"smooth"});
