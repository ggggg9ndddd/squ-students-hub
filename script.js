import { auth, db, googleProvider } from "./firebase-config.js";
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const $ = (s) => document.querySelector(s);
const state = { user:null, posts:[], myOnly:false, unsubscribe:null };
const fallbackAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' rx='50' fill='%23143b35'/%3E%3Ctext x='50' y='63' text-anchor='middle' font-size='44'%3E👤%3C/text%3E%3C/svg%3E";

function escapeHTML(value=""){return String(value).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function notice(title,text){$("#noticeTitle").textContent=title;$("#noticeText").textContent=text;$("#noticeDialog").showModal();}
function requireLogin(){if(!state.user){notice("سجّل الدخول أولًا","تسجيل الدخول بحساب Google مطلوب لإضافة الملفات.");return false;}return true;}
function formatDate(ts){if(!ts?.toDate)return "الآن";return new Intl.DateTimeFormat("ar-OM",{day:"numeric",month:"long",year:"numeric"}).format(ts.toDate());}
function isDriveLink(value){try{const u=new URL(value);return u.protocol==="https:" && (u.hostname==="drive.google.com" || u.hostname==="docs.google.com");}catch{return false;}}
async function ensureUser(user){await setDoc(doc(db,"users",user.uid),{uid:user.uid,name:user.displayName||"مستخدم",email:user.email||"",photoURL:user.photoURL||"",lastSeen:serverTimestamp()},{merge:true});}

function startPosts(){
  state.unsubscribe?.();
  state.unsubscribe=onSnapshot(query(collection(db,"posts"),orderBy("createdAt","desc"),limit(150)),snap=>{state.posts=snap.docs.map(d=>({id:d.id,...d.data()}));renderPosts();},err=>{console.error(err);$("#feed").innerHTML='<p class="empty">تعذر تحميل الملفات. تأكد من نشر قواعد Firestore.</p>';});
}
function renderPosts(){
  const term=$("#searchInput").value.trim().toLowerCase();
  const category=$("#categoryFilter").value;
  const posts=state.posts.filter(p=>(!state.myOnly||p.uid===state.user?.uid)&&(!category||p.category===category)&&(!term||`${p.title||""} ${p.description||""} ${p.course||""} ${p.userName||""}`.toLowerCase().includes(term)));
  const feed=$("#feed");
  if(!posts.length){feed.innerHTML='<p class="empty">لا توجد ملفات مطابقة حاليًا.</p>';return;}
  feed.innerHTML=posts.map(p=>`<article class="resource-card">
    <div class="resource-head"><span class="file-icon">↗</span><span class="category-pill">${escapeHTML(p.category||"ملف")}</span></div>
    <div class="resource-body"><p class="course-name">${escapeHTML(p.course||"")}</p><h3>${escapeHTML(p.title||"")}</h3><p class="resource-description">${escapeHTML(p.description||"")}</p></div>
    <div class="resource-author"><img class="avatar" src="${p.userPhoto||fallbackAvatar}" alt=""><div><strong>${escapeHTML(p.userName||"مستخدم")}</strong><small>${formatDate(p.createdAt)}</small></div></div>
    <div class="resource-actions"><a class="open-link" href="${escapeHTML(p.driveUrl||"#")}" target="_blank" rel="noopener noreferrer">فتح الملف في Google Drive</a>${p.uid===state.user?.uid?`<button class="delete-btn" data-delete="${p.id}">حذف</button>`:""}</div>
  </article>`).join("");
  feed.querySelectorAll("[data-delete]").forEach(btn=>btn.onclick=()=>removePost(btn.dataset.delete));
}
async function removePost(id){if(!confirm("هل تريد حذف هذا الرابط؟"))return;try{await deleteDoc(doc(db,"posts",id));}catch(err){console.error(err);notice("تعذر الحذف","لا يمكنك حذف رابط لا تملكه.");}}
function openPostDialog(){if(requireLogin())$("#postDialog").showModal();}

$("#postForm").onsubmit=async(e=>{e.preventDefault();if(!requireLogin())return;
  const title=$("#postTitle").value.trim(), category=$("#postCategory").value, course=$("#postCourse").value.trim(), driveUrl=$("#postLink").value.trim(), description=$("#postDescription").value.trim(), btn=$("#publishPost");
  if(!isDriveLink(driveUrl)){notice("الرابط غير صحيح","أدخل رابطًا من Google Drive أو Google Docs يبدأ بـ https://");return;}
  btn.disabled=true;btn.textContent="جارٍ النشر…";
  try{await addDoc(collection(db,"posts"),{uid:state.user.uid,userName:state.user.displayName||"مستخدم",userPhoto:state.user.photoURL||"",title,category,course,driveUrl,description,createdAt:serverTimestamp()});e.target.reset();$("#postDialog").close();}
  catch(err){console.error(err);notice("تعذر نشر الرابط","تأكد من نشر قواعد Firestore ثم حاول مرة أخرى.");}
  finally{btn.disabled=false;btn.textContent="نشر الرابط";}
});

$("#googleLogin").onclick=async()=>{const btn=$("#googleLogin");btn.disabled=true;try{await signInWithPopup(auth,googleProvider);}catch(err){console.error(err);notice("تعذر تسجيل الدخول",err.code==="auth/unauthorized-domain"?"أضف نطاق GitHub Pages في Authorized domains داخل Firebase.":"أُغلقت نافذة تسجيل الدخول أو تعذر الاتصال.");}finally{btn.disabled=false;}};
$("#logoutButton").onclick=()=>signOut(auth);
onAuthStateChanged(auth,async user=>{state.user=user;if(user){await ensureUser(user);$("#googleLogin").hidden=true;$("#userMenu").hidden=false;$("#userName").textContent=user.displayName||"مستخدم";$("#userEmail").textContent=user.email||"";$("#userPhoto").src=user.photoURL||fallbackAvatar;startPosts();}else{$("#googleLogin").hidden=false;$("#userMenu").hidden=true;state.posts=[];state.unsubscribe?.();$("#feed").innerHTML='<p class="empty">سجّل الدخول لمشاهدة الملفات ومشاركة رابطك.</p>';}});

$("#searchInput").oninput=renderPosts;$("#categoryFilter").onchange=renderPosts;
$("#myPostsBtn").onclick=()=>{if(!requireLogin())return;state.myOnly=!state.myOnly;$("#myPostsBtn").classList.toggle("active",state.myOnly);$("#myPostsBtn").textContent=state.myOnly?"عرض الجميع":"ملفاتي";renderPosts();};
$("#addPostBtn").onclick=openPostDialog;$("#heroAddPost").onclick=openPostDialog;$("#browsePosts").onclick=()=>$("#postsSection").scrollIntoView({behavior:"smooth"});
$("#themeToggle").onclick=()=>{document.body.classList.toggle("dark");const dark=document.body.classList.contains("dark");$("#themeToggle").textContent=dark?"☀":"☾";localStorage.setItem("theme",dark?"dark":"light");};if(localStorage.getItem("theme")==="dark"){document.body.classList.add("dark");$("#themeToggle").textContent="☀";}
document.querySelectorAll("[data-close]").forEach(btn=>btn.onclick=()=>document.getElementById(btn.dataset.close).close());
