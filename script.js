import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB4QdGcm1bCL_ILvBKVnNxc-DmTmkcfH1k",
  authDomain: "kicyou-5135e.firebaseapp.com",
  projectId: "kicyou-5135e",
  storageBucket: "kicyou-5135e.firebasestorage.app",
  messagingSenderId: "141262071037",
  appId: "1:141262071037:web:8bec6bc3558867eed44a94",
  measurementId: "G-RMJF6NNDMX"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM 元素
const balanceEl = document.getElementById('totalBalance');
const incomeEl = document.getElementById('totalIncome');
const expenseEl = document.getElementById('totalExpense');
const recentListEl = document.getElementById('recentList');
const overviewEl = document.getElementById('tabOverview');
const filterListEl = document.getElementById('filterList');
const form = document.getElementById('transactionForm');
const editIdInput = document.getElementById('editId');
const dateInput = document.getElementById('date');
const textInput = document.getElementById('text');
const amountInput = document.getElementById('amount');
const categoryInput = document.getElementById('categoryInput');
const filterCategory = document.getElementById('filterCategory');
const filterMonth = document.getElementById('filterMonth');
const submitBtn = document.getElementById('submitBtn');
const cancelBtn = document.getElementById('cancelBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const resetStepBtn = document.getElementById('resetStepBtn');

// 每月小結元素
const mBalance = document.getElementById('mBalance');
const mIncome = document.getElementById('mIncome');
const mExpense = document.getElementById('mExpense');
const monthlySummaryPanel = document.getElementById('monthlySummaryPanel');

const todayStr = new Date().toISOString().split('T')[0];
dateInput.value = todayStr;
filterMonth.value = todayStr.substring(0, 7);

let transactions = [];
let currentTheme = localStorage.getItem('theme') || 'light';
let myChart = null;
let resetStep = 0;

// 記錄歸零的時間點（在此時間之前的舊資料不計入主畫面總額，但新資料會正常累加）
let resetTimestamp = localStorage.getItem('resetTimestamp') || 0;

applyTheme();

// 主題切換
themeToggleBtn.addEventListener('click', () => {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', currentTheme);
    applyTheme();
});

function applyTheme() {
    const isDark = currentTheme === 'dark';
    
    document.getElementById('bodyBg').className = isDark ? 'bg-gray-900 min-h-screen py-6 px-4 transition-colors duration-300 text-gray-100' : 'bg-gray-100 min-h-screen py-6 px-4 transition-colors duration-300 text-gray-800';
    document.getElementById('cardBg').className = isDark ? 'max-w-md mx-auto bg-gray-800 rounded-2xl shadow-lg overflow-hidden transition-colors duration-300 text-gray-100 p-6' : 'max-w-md mx-auto bg-white rounded-2xl shadow-lg overflow-hidden transition-colors duration-300 text-gray-800 p-6';
    
    const balancePanel = document.getElementById('balancePanel');
    balancePanel.className = isDark ? 'bg-gray-700 border border-gray-600 rounded-xl p-4 text-center mb-6 text-gray-100' : 'bg-blue-50 border border-blue-100 rounded-xl p-4 text-center mb-6 text-gray-800';

    if (monthlySummaryPanel) {
        monthlySummaryPanel.className = isDark ? 'bg-gray-700 border border-gray-600 p-3 rounded-lg text-xs flex justify-around text-center text-gray-100' : 'bg-gray-50 border p-3 rounded-lg text-xs flex justify-around text-center text-gray-800';
    }

    const inputs = [dateInput, amountInput, textInput, categoryInput, filterCategory, filterMonth];
    inputs.forEach(input => {
        if(input) {
            input.className = isDark ? 'w-full px-3 py-2 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white text-sm' : 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-transparent text-gray-800 text-sm';
        }
    });

    const radios = document.querySelectorAll('form .grid-cols-2 label');
    radios.forEach(label => {
        label.className = isDark ? 'border border-gray-600 bg-gray-700 rounded-lg p-2 text-center cursor-pointer flex items-center justify-center space-x-2' : 'border rounded-lg p-2 text-center cursor-pointer flex items-center justify-center space-x-2 bg-transparent';
    });

    themeToggleBtn.innerText = isDark ? '☀️' : '🌙';
    render();
}

// 兩步驟重製按鈕邏輯
resetStepBtn.addEventListener('click', () => {
    if (resetStep === 0) {
        resetStep = 1;
        resetStepBtn.innerText = '確認歸零？';
        resetStepBtn.className = 'bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-2.5 rounded-lg transition';
        
        setTimeout(() => {
            if (resetStep === 1) {
                resetStep = 0;
                resetStepBtn.innerText = resetTimestamp > 0 ? '解除歸零' : '重製';
                resetStepBtn.className = 'bg-gray-300 hover:bg-gray-400 text-gray-700 text-sm px-3 py-2.5 rounded-lg transition';
            }
        }, 3000);
    } else {
        if (resetTimestamp > 0) {
            // 如果已經是歸零狀態，點擊則為「解除歸零」（恢復計算全部歷史資料）
            resetTimestamp = 0;
            resetStepBtn.innerText = '重製';
        } else {
            // 設定當前時間戳記為歸零點，之後的資料正常累加，之前的暫時不計入總結餘
            resetTimestamp = Date.now();
            resetStepBtn.innerText = '解除歸零';
        }
        localStorage.setItem('resetTimestamp', resetTimestamp);

        window.resetForm();
        resetStep = 0;
        resetStepBtn.className = 'bg-gray-300 hover:bg-gray-400 text-gray-700 text-sm px-3 py-2.5 rounded-lg transition';
        render();
    }
});

// 頁面切換控制
window.switchView = function(view) {
    document.getElementById('homeView').classList.toggle('hidden', view !== 'home');
    document.getElementById('detailsView').classList.toggle('hidden', view !== 'details');
}

// 子分頁切換控制
window.switchTab = function(tab) {
    document.getElementById('tabOverview').classList.toggle('hidden', tab !== 'overview');
    document.getElementById('tabFilter').classList.toggle('hidden', tab !== 'filter');
    document.getElementById('tabChart').classList.toggle('hidden', tab !== 'chart');

    const isDark = currentTheme === 'dark';
    document.getElementById('tabBtnOverview').className = tab === 'overview' ? 'py-2 rounded-lg bg-blue-600 text-white shadow' : (isDark ? 'py-2 rounded-lg text-gray-400' : 'py-2 rounded-lg text-gray-600');
    document.getElementById('tabBtnFilter').className = tab === 'filter' ? 'py-2 rounded-lg bg-blue-600 text-white shadow' : (isDark ? 'py-2 rounded-lg text-gray-400' : 'py-2 rounded-lg text-gray-600');
    document.getElementById('tabBtnChart').className = tab === 'chart' ? 'py-2 rounded-lg bg-blue-600 text-white shadow' : (isDark ? 'py-2 rounded-lg text-gray-400' : 'py-2 rounded-lg text-gray-600');

    if (tab === 'chart') renderChart();
}

// Firebase 即時監聽
onSnapshot(collection(db, "transactions"), (snapshot) => {
    transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    render();
});

// 表單送出 (新增/修改)
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.querySelector('input[name="type"]:checked').value;
    const category = categoryInput.value;
    const date = dateInput.value;
    const text = textInput.value.trim();
    const amount = parseFloat(amountInput.value);
    const editId = editIdInput.value;

    if (!date || !text || isNaN(amount) || amount <= 0) return alert('請完整填寫欄位！');

    try {
        if (!editId) {
            // 新增時記錄當下的時間戳記，確保歸零後新加的資料一定會被算進去
            await addDoc(collection(db, "transactions"), { type, category, date, text, amount, createdAt: Date.now() });
        } else {
            await updateDoc(doc(db, "transactions", editId), { type, category, date, text, amount });
        }
        window.resetForm();
    } catch (err) { console.error(err); }
});

window.editTransaction = function(id) {
    const item = transactions.find(t => t.id === id);
    if (!item) return;
    editIdInput.value = item.id;
    dateInput.value = item.date;
    textInput.value = item.text;
    amountInput.value = item.amount;
    categoryInput.value = item.category || '其他';
    document.querySelector(`input[name="type"][value="${item.type}"]`).checked = true;
    submitBtn.innerText = '儲存修改';
    submitBtn.className = 'w-full bg-green-600 text-white font-medium py-2.5 rounded-lg hover:bg-green-700 transition shadow';
    cancelBtn.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.resetForm = function() {
    editIdInput.value = '';
    dateInput.value = todayStr;
    textInput.value = '';
    amountInput.value = '';
    document.querySelector('input[name="type"][value="expense"]').checked = true;
    submitBtn.innerText = '新增紀錄';
    submitBtn.className = 'w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 transition shadow';
    cancelBtn.classList.add('hidden');
}

window.removeTransaction = async function(id) {
    if (editIdInput.value == id) window.resetForm();
    await deleteDoc(doc(db, "transactions", id));
}

// 篩選變動時重新渲染
filterCategory.addEventListener('change', renderFilterList);
filterMonth.addEventListener('change', renderFilterList);

function render() {
    let totalIncome = 0, totalExpense = 0;
    recentListEl.innerHTML = '';
    overviewEl.innerHTML = '';

    if (transactions.length === 0) {
        recentListEl.innerHTML = '<p class="text-gray-400 text-center text-xs py-2">目前沒有紀錄</p>';
        overviewEl.innerHTML = '<p class="text-gray-400 text-center text-sm py-4">目前沒有明細</p>';
    }

    const isDark = currentTheme === 'dark';
    const limitTime = Number(resetTimestamp);

    transactions.forEach((item, index) => {
        // 如果有設定歸零點，且該筆資料是在歸零點之前建立的，則不計入主畫面的總結餘與收支計算
        const itemTime = item.createdAt || 0;
        if (limitTime === 0 || itemTime > limitTime) {
            if (item.type === 'income') totalIncome += item.amount;
            else totalExpense += item.amount;
        }

        const cardClass = isDark 
            ? 'flex justify-between items-center bg-gray-700 border border-gray-600 p-3 rounded-lg text-sm text-gray-100'
            : 'flex justify-between items-center bg-gray-50 border border-gray-100 p-3 rounded-lg text-sm text-gray-800';

        const html = `
            <div class="${cardClass}">
                <div>
                    <span class="text-xs text-gray-400">${item.date} | <span class="text-blue-400 font-semibold">${item.category || '其他'}</span></span>
                    <span class="font-medium block ${isDark ? 'text-gray-100' : 'text-gray-800'}">${item.text}</span>
                </div>
                <div class="flex items-center space-x-2">
                    <span class="${item.type === 'income' ? 'text-green-400' : 'text-red-400'} font-bold">${item.type === 'income' ? '+' : '-'}$${item.amount}</span>
                    <button onclick="editTransaction('${item.id}')" class="text-blue-300 text-xs px-1.5 py-0.5 bg-blue-900 bg-opacity-40 rounded">✏️</button>
                    <button onclick="removeTransaction('${item.id}')" class="text-red-400 font-bold text-sm px-1">×</button>
                </div>
            </div>
        `;

        if (index < 3) recentListEl.innerHTML += html;
        overviewEl.innerHTML += html;
    });

    balanceEl.innerText = `$${totalIncome - totalExpense}`;
    incomeEl.innerText = `$${totalIncome}`;
    expenseEl.innerText = `$${totalExpense}`;
    resetStepBtn.innerText = limitTime > 0 ? '解除歸零' : '重製';

    renderFilterList();
}

function renderFilterList() {
    const selectedMonth = filterMonth.value; 
    const selectedCat = filterCategory.value;

    const filtered = transactions.filter(t => {
        const matchMonth = selectedMonth ? t.date.startsWith(selectedMonth) : true;
        const matchCat = selectedCat ? t.category === selectedCat : true;
        return matchMonth && matchCat;
    });

    let mInc = 0, mExp = 0;
    transactions.filter(t => selectedMonth ? t.date.startsWith(selectedMonth) : true).forEach(t => {
        if (t.type === 'income') mInc += t.amount;
        else mExp += t.amount;
    });

    mIncome.innerText = `$${mInc}`;
    mExpense.innerText = `$${mExp}`;
    mBalance.innerText = `$${mInc - mExp}`;
    mBalance.className = `font-bold text-sm ${mInc - mExp >= 0 ? 'text-blue-500' : 'text-red-500'}`;

    const isDark = currentTheme === 'dark';
    
    filterListEl.innerHTML = filtered.length === 0 ? '<p class="text-gray-400 text-center text-sm py-4">無符合條件的紀錄</p>' : '';
    filtered.forEach(item => {
        const cardClass = isDark 
            ? 'flex justify-between items-center bg-gray-700 border border-gray-600 p-3 rounded-lg text-sm text-gray-100'
            : 'flex justify-between items-center bg-gray-50 border border-gray-100 p-3 rounded-lg text-sm text-gray-800';

        filterListEl.innerHTML += `
            <div class="${cardClass}">
                <div>
                    <span class="text-xs text-gray-400">${item.date} | <span class="text-blue-400">${item.category || '其他'}</span></span>
                    <span class="font-medium block ${isDark ? 'text-gray-100' : 'text-gray-800'}">${item.text}</span>
                </div>
                <span class="${item.type === 'income' ? 'text-green-400' : 'text-red-400'} font-bold">${item.type === 'income' ? '+' : '-'}$${item.amount}</span>
            </div>
        `;
    });
}

function renderChart() {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    const catTotals = {};
    
    transactions.filter(t => t.type === 'expense').forEach(t => {
        const cat = t.category || '其他';
        catTotals[cat] = (catTotals[cat] || 0) + t.amount;
    });

    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(catTotals),
            datasets: [{
                data: Object.values(catTotals),
                backgroundColor: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6']
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: currentTheme === 'dark' ? '#f3f4f6' : '#1f2937'
                    }
                }
            }
        }
    });
}