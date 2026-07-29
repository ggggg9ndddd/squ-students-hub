const AI_WORKER_URL = 'https://tiny-firefly-19cb.dr-alrumhi.workers.dev';
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
const clearButton = document.querySelector('#clearResult');
const charCount = document.querySelector('#charCount');

function todayKey() {
  return `squ-ai-${new Date().toISOString().slice(0, 10)}`;
}

function usedToday() {
  return Number(localStorage.getItem(todayKey()) || 0);
}

function updateCounter() {
  if (!counter) return;
  counter.textContent = `المتبقي: ${Math.max(0, DAILY_LIMIT - usedToday())}`;
}

function updateOptions() {
  if (quizOptions) quizOptions.hidden = task?.value !== 'quiz';
  if (planOptions) planOptions.hidden = task?.value !== 'plan';
}

function escapeHTML(value = '') {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[character]);
}

function renderText(text) {
  return escapeHTML(text)
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(?:<li>.*<\/li>\n?)+/g, match => `<ul>${match}</ul>`)
    .replace(/\n/g, '<br>');
}

task?.addEventListener('change', updateOptions);

input?.addEventListener('input', () => {
  if (charCount) {
    charCount.textContent = `${input.value.length} / 12000`;
  }
});

clearButton?.addEventListener('click', () => {
  result.className = 'ai-result empty-result';
  result.textContent = 'اختر المهمة، أدخل النص، ثم اضغط «ابدأ الآن».';
  result.dataset.raw = '';
  copyButton.disabled = true;
  statusText.textContent = 'ستظهر النتيجة هنا.';
});

copyButton?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(
      result.dataset.raw || result.innerText
    );

    copyButton.textContent = 'تم النسخ ✓';

    setTimeout(() => {
      copyButton.textContent = 'نسخ';
    }, 1500);
  } catch {
    alert('تعذر نسخ النتيجة.');
  }
});

form?.addEventListener('submit', async event => {
  event.preventDefault();

  if (usedToday() >= DAILY_LIMIT) {
    alert('وصلت إلى الحد اليومي للمساعد الذكي. جرّب غدًا.');
    return;
  }

  const text = input.value.trim();

  if (text.length < 20) {
    alert('أدخل نصًا لا يقل عن 20 حرفًا.');
    return;
  }

  if (text.length > 12000) {
    alert('النص يتجاوز الحد المسموح وهو 12000 حرف.');
    return;
  }

  generateButton.disabled = true;
  generateButton.textContent = 'جارٍ إعداد النتيجة…';

  result.className = 'ai-result loading-result';
  result.textContent = 'يفكر المساعد ويجهز الإجابة…';
  statusText.textContent = 'يرجى الانتظار.';
  copyButton.disabled = true;

  try {
    const response = await fetch(AI_WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        task: task.value,
        text,
        language: document.querySelector('#aiLanguage')?.value || 'ar',
        level: document.querySelector('#aiLevel')?.value || 'university',
        quizType: document.querySelector('#quizType')?.value || 'mcq',
        quizCount: Number(
          document.querySelector('#quizCount')?.value || 10
        ),
        examDate: document.querySelector('#examDate')?.value || '',
        dailyHours: Number(
          document.querySelector('#dailyHours')?.value || 2
        )
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error || 'تعذر الاتصال بالمساعد الذكي.'
      );
    }

    if (!data.text) {
      throw new Error('لم يرجع المساعد نتيجة.');
    }

    localStorage.setItem(
      todayKey(),
      String(usedToday() + 1)
    );

    updateCounter();

    result.dataset.raw = data.text;
    result.className = 'ai-result';
    result.innerHTML = renderText(data.text);
    statusText.textContent = 'اكتملت النتيجة.';
    copyButton.disabled = false;
  } catch (error) {
    result.className = 'ai-result error-result';
    result.textContent = error.message;
    statusText.textContent = 'حدث خطأ.';
  } finally {
    generateButton.disabled = false;
    generateButton.textContent = 'ابدأ الآن ✨';
  }
});

updateOptions();
updateCounter();
