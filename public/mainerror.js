// 🔐 Redirect if not logged in
if (!localStorage.getItem('token')) {
    window.location.href = 'login.html';
}

// Handle tab switching
document.querySelectorAll('nav button[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('nav button[data-tab]').forEach(b => b.classList.remove('active'));

        const tabId = btn.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
        btn.classList.add('active');
    });
});

// Logout
document.getElementById('logout').addEventListener('click', () => {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
});

// Load user name
async function loadUserName() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        document.getElementById('welcome-user').textContent = `Welcome, ${data.name} 👋`;
    } catch (err) {
        console.error('Error loading user:', err);
    }
}

// Full coin list
let coinList = [];
let watchlist = JSON.parse(localStorage.getItem('watchlist')) || ['bitcoin', 'ethereum'];

async function fetchCoinList() {
    try {
        const res = await fetch('https://api.coingecko.com/api/v3/coins/list');
        coinList = await res.json();
    } catch (err) {
        console.error('Error loading coin list:', err);
    }
}

function updateWatchlist(newList) {
    watchlist = newList;
    localStorage.setItem('watchlist', JSON.stringify(watchlist));
    loadMarketData();
}

// Load market data
async function loadMarketData() {
    const table = document.querySelector('#market-table tbody');
    if (!watchlist.length) {
        table.innerHTML = '<tr><td colspan="6" class="text-center text-gray-400">No coins in watchlist</td></tr>';
        return;
    }

    try {
        const ids = watchlist.join(',');
        const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&sparkline=true`);
        const data = await res.json();
        table.innerHTML = '';

        data.forEach(coin => {
            const sparkline = coin.sparkline_in_7d?.price || [];
            const points = sparkline.map((p, i) => `${i * 3},${100 - (p / Math.max(...sparkline)) * 100}`).join(' ');

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="p-2 border">${coin.name}</td>
                <td class="p-2 border">${coin.symbol.toUpperCase()}</td>
                <td class="p-2 border">$${coin.current_price.toLocaleString()}</td>
                <td class="p-2 border" style="color:${coin.price_change_percentage_24h >= 0 ? 'limegreen' : 'red'}">
                    ${coin.price_change_percentage_24h.toFixed(2)}%
                </td>
                <td class="p-2 border">
                    <svg width="100" height="30" viewBox="0 0 100 100">
                        <polyline points="${points}" fill="none" stroke="#00ff9d" stroke-width="2"/>
                    </svg>
                </td>
                <td class="p-2 border text-center">
                    <button class="text-red-400 hover:text-red-600 font-bold" onclick="removeCoin('${coin.id}')">🗑</button>
                </td>
            `;
            row.addEventListener('click', () => loadChart(coin.id, coin.name));
            table.appendChild(row);
            
  

        });
    } catch (err) {
        console.error(err);
        table.innerHTML = '<tr><td colspan="6" style="color:red;">Error loading market data</td></tr>';
    }
}

function removeCoin(coinId) {
    const filtered = watchlist.filter(id => id !== coinId);
    updateWatchlist(filtered);
}

document.getElementById('add-coin').addEventListener('click', () => {
    const input = document.getElementById('new-coin-input');
    const newSymbol = input.value.trim().toLowerCase();
    if (!newSymbol) return;

    const match = coinList.find(c => c.symbol.toLowerCase() === newSymbol);
    if (!match) return alert('❌ Coin not found');

    if (watchlist.includes(match.id)) {
        alert('⚠️ Coin already in watchlist');
        return;
    }

    updateWatchlist([...watchlist, match.id]);
    input.value = '';
});

//logic for chart
let chartInstance;
let currentChartSymbol = null;
let currentChartName = null;
let chartRangeDays = '1'; // default is 1 day (24h)


async function loadChart(symbol, name) {
    currentChartSymbol = symbol;
    currentChartName = name;
  
    const now = Math.floor(Date.now() / 1000);
    const from = now - (chartRangeDays * 86400);
  
    const url = `https://api.coingecko.com/api/v3/coins/${symbol}/market_chart/range?vs_currency=usd&from=${from}&to=${now}`;
  
    try {
      const res = await fetch(url);
      const data = await res.json();
  
      const step = Math.max(1, Math.floor(data.prices.length / 100));
      const labels = [];
      const prices = [];
  
      for (let i = 0; i < data.prices.length; i += step) {
        labels.push(new Date(data.prices[i][0]).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        }));
        prices.push(data.prices[i][1]);
      }
  
      if (chartInstance) chartInstance.destroy();
  
      const ctx = document.getElementById('cryptoChart').getContext('2d');
  
      const gradient = ctx.createLinearGradient(0, 0, 0, 200);
      gradient.addColorStop(0, 'rgba(0,255,0,0.4)');
      gradient.addColorStop(1, 'rgba(0,255,0,0)');
  
      chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: `${name} (${chartRangeDays}d)`,
            data: prices,
            borderColor: 'lime',
            backgroundColor: gradient,
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          scales: {
            x: {
              ticks: { color: 'white' },
              grid: { color: '#444' }
            },
            y: {
              ticks: { color: 'white' },
              grid: { color: '#444' }
            }
          },
          plugins: {
            tooltip: {
              backgroundColor: '#111',
              borderColor: '#0f0',
              borderWidth: 1,
              cornerRadius: 4,
              padding: 10,
              titleColor: '#0f0',
              bodyColor: '#fff',
              callbacks: {
                label: ctx => `$${ctx.parsed.y.toFixed(2)}`
              }
            },
            legend: {
              labels: {
                color: 'white'
              }
            },
            zoom: {
              pan: { enabled: true, mode: 'x' },
              zoom: {
                wheel: { enabled: true },
                pinch: { enabled: true },
                mode: 'x'
              }
            }
          }
        }
      });
  
      document.getElementById('selected-coin-name').textContent = name;
  
      // Switch to Chart tab
      document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.getElementById('chart').classList.add('active');
  
    } catch (err) {
      console.error('Error loading chart:', err);
    }
  }
  


// Buy Form Logic (with debugging logs)
// ✅ Buy Form Validation Logic


function validateBuyForm() {
  const symbol = buySymbolInput.value.trim().toLowerCase();
  const usd = parseFloat(buyAmountInput.value);
  const match = coinList.find(c => c.symbol.toLowerCase() === symbol);
  const valid = match && !isNaN(usd) && usd > 0;

  buySubmitBtn.disabled = !valid;
  buySubmitBtn.classList.toggle('opacity-50', !valid);
}

buySymbolInput.addEventListener('input', validateBuyForm);
buyAmountInput.addEventListener('input', validateBuyForm);

// ✅ Buy Form Submission
document.getElementById('buy-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const symbol = buySymbolInput.value.trim().toLowerCase();
  const usd = parseFloat(buyAmountInput.value);
  const result = document.getElementById('buy-result');

  console.log('🔍 User entered symbol:', symbol);
  console.log('📦 Loaded coinList:', coinList);

  const coin = coinList.find(c => c.symbol.toLowerCase() === symbol);
  console.log('✅ Matched coin object:', coin);

  if (!coin) {
    result.textContent = '❌ Coin not found in CoinGecko list';
    result.style.color = 'red';
    return;
  }

  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coin.id}&vs_currencies=usd`);
    const priceData = await res.json();
    const price = priceData[coin.id]?.usd;

    if (!price) throw new Error('Price not found in response');

    const units = usd / price;
    result.textContent = '';

    const history = JSON.parse(localStorage.getItem('buyHistory') || '[]');
    history.push({
      symbol: symbol.toUpperCase(),
      usd: usd.toFixed(2),
      amount: units.toFixed(6),
      status: 'Pending admin approval',
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('buyHistory', JSON.stringify(history));

    renderBuyHistory();
  } catch (err) {
    result.textContent = '❌ Failed to fetch price';
    result.style.color = 'red';
    console.error('❌ Error fetching price:', err);
  }
});



// Sell Form Logic
document.getElementById('sell-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const symbol = document.getElementById('sell-symbol').value.trim().toLowerCase();
    const usd = parseFloat(document.getElementById('sell-amount').value);
    const result = document.getElementById('sell-result');

    const coin = coinList.find(c => c.symbol.toLowerCase() === symbol);
    if (!coin) {
        result.textContent = '❌ Coin not found';
        result.style.color = 'red';
        return;
    }

    try {
        const res = await fetch(`/api/price/${coin.id}`);
        const priceData = await res.json();
        const price = priceData[coin.id]?.usd;
      
        if (!price) {
          result.textContent = '❌ Failed to fetch price';
          result.style.color = 'red';
          return;
        }
      
        const units = usd / price;
      
        result.style.color = 'orange';
        result.innerHTML = `
          You requested to sell <strong>${units.toFixed(6)} ${symbol.toUpperCase()}</strong> for <strong>$${usd}</strong>.<br>
          <strong>Status:</strong> <span class="text-yellow-300">Pending admin approval</span>
        `;
      } catch (err) {
        result.textContent = '❌ Failed to fetch price';
        result.style.color = 'red';
        console.error(err);
      }

});



async function loadWallet() {
    const token = localStorage.getItem('token');
    const table = document.querySelector('#wallet-table tbody');
    table.innerHTML = '<tr><td colspan="6" class="text-center text-gray-400">Loading wallet...</td></tr>';
  
    try {
      // Fetch wallet from backend
      const res1 = await fetch('/api/user/wallet', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res1.json();
      console.log('Wallet response:', data);
  
      const wallet = data.wallet || {};
      const symbols = Object.keys(wallet);
      if (symbols.length === 0) {
        table.innerHTML = '<tr><td colspan="6" class="text-center text-gray-400">No holdings</td></tr>';
        return;
      }
  
      // Map symbols to CoinGecko IDs (extend as needed)
      const symbolToId = {
        btc: 'bitcoin',
        eth: 'ethereum',
        usdt: 'tether',
        bnb: 'binancecoin',
        ada: 'cardano',
        xrp: 'ripple',
        doge: 'dogecoin',
        sol: 'solana'
      };
  
      const ids = symbols.map(sym => symbolToId[sym]).filter(Boolean);
      console.log('Fetching prices for:', ids);
  
      const res2 = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids.join(',')}`);
      const prices = await res2.json();
  
      // Calculate total portfolio value
      let totalValue = 0;
      const rows = prices.map(coin => {
        const symbol = coin.symbol.toLowerCase();
        const amount = wallet[symbol] || 0;
        const value = amount * coin.current_price;
        totalValue += value;
        return { coin, amount, value };
  

      });

      // ✅ Make TPV available globally for AI simulation
window.totalPortfolioValue = totalValue;
      
      document.getElementById('total-value').textContent = `Total Portfolio Value: $${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;


      // Render table
      table.innerHTML = '';
      rows.forEach(({ coin, amount, value }) => {
        const percent = ((value / totalValue) * 100).toFixed(2);
        const row = document.createElement('tr');
        row.innerHTML = `
          <td class="p-2 border">${coin.name}</td>
          <td class="p-2 border">${coin.symbol.toUpperCase()}</td>
          <td class="p-2 border">${amount}</td>
          <td class="p-2 border">$${coin.current_price.toLocaleString()}</td>
          <td class="p-2 border">$${value.toFixed(2)}</td>
          <td class="p-2 border">${percent}%</td>
        `;
        table.appendChild(row);
      });
  
    } catch (err) {
      console.error('Error loading wallet:', err);
      table.innerHTML = '<tr><td colspan="6" style="color:red;">Error loading wallet</td></tr>';
    }
  }
  
  function renderBuyHistory() {
    const history = JSON.parse(localStorage.getItem('buyHistory') || '[]');
    const tbody = document.getElementById('buy-history-body');
    tbody.innerHTML = '';
  
    history.forEach((entry, index) => {
        const isEditable = !entry.status.toLowerCase().includes('approved');
        const row = document.createElement('tr');
      
        row.innerHTML = `
          <td class="p-2 border">${entry.symbol}</td>
          <td class="p-2 border">$${entry.usd}</td>
          <td class="p-2 border">${entry.amount}</td>
          <td class="p-2 border text-yellow-300">
  ${entry.status} — ${new Date(entry.timestamp).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })}
</td>

          <td class="p-2 border text-center">
            ${isEditable ? `
              <button onclick="editEntry(${index})" class="text-blue-400 hover:text-blue-600 font-semibold mr-2">Edit</button>
              <button onclick="deleteEntry(${index})" class="text-red-400 hover:text-red-600 font-semibold">Delete</button>
            ` : `<span class="text-gray-400">N/A</span>`}
          </td>
        `;
        tbody.appendChild(row);
      });
      
  }
  



  function editEntry(index) {
    const history = JSON.parse(localStorage.getItem('buyHistory') || '[]');
    const entry = history[index];
  
    if (entry.status.toLowerCase().includes('approved')) {
      alert('❌ You cannot edit an approved transaction.');
      return;
    }
  
    if (!confirm(`Edit ${entry.symbol} transaction?`)) return;
  
    const newUSD = prompt('💵 Edit USD amount:', entry.usd);
    if (newUSD === null || isNaN(newUSD) || Number(newUSD) <= 0) {
      alert('❌ Invalid USD amount.');
      return;
    }
  
    const newAmount = prompt('🪙 Edit crypto amount:', entry.amount);
    if (newAmount === null || isNaN(newAmount) || Number(newAmount) <= 0) {
      alert('❌ Invalid crypto amount.');
      return;
    }
  
    history[index].usd = parseFloat(newUSD).toFixed(2);
    history[index].amount = parseFloat(newAmount).toFixed(6);
    history[index].timestamp = new Date().toISOString();
  
    localStorage.setItem('buyHistory', JSON.stringify(history));
    renderBuyHistory();
  }
  
  
  function deleteEntry(index) {
    const history = JSON.parse(localStorage.getItem('buyHistory') || '[]');
  
    if (history[index].status.toLowerCase().includes('approved')) {
      alert('You cannot delete an approved transaction.');
      return;
    }
  
    if (confirm('Are you sure you want to delete this entry?')) {
      history.splice(index, 1);
      localStorage.setItem('buyHistory', JSON.stringify(history));
      renderBuyHistory();
    }
  }
  
  function resetZoom() {
    if (chartInstance) {
      chartInstance.resetZoom();
    }
  }
  
  window.resetZoom = resetZoom;

  function setChartRange(days) {
    chartRangeDays = days;
    if (currentChartSymbol && currentChartName) {
      loadChart(currentChartSymbol, currentChartName);
    }
  }
  // window.setChartRange = setChartRange; // ✅ Make sure this is added!
//simulation AI tab 
let aiSimInterval;
let aiSimTable = document.getElementById("ai-sim-table");
let aiThoughtsBox;

async function startAiSimulation() {
  const thoughts = [
    "Analyzing ETH trends...",
    "High confidence in BTC rebound",
    "Monitoring whale activity...",
    "Slight dip — holding assets",
    "Scanning for entry points...",
    "News suggests caution — minor sell-off",
    "Watching USDT market stability...",
    "No major movement — maintaining positions",
  ];

  const base = window.totalPortfolioValue;

  if (!base || base <= 0) {
    console.warn("No valid TPV — skipping CryptoAI simulation.");
    document.getElementById("cryptoai-value").textContent = "CryptoAI Simulated Value: (not enough data)";
    return; // ⛔ Stop simulation early
  }
  
  let simulatedValue = base;
  

  // Restore state if available

  let saved = {};
try {
  const token = localStorage.getItem("token");
  const res = await fetch('/api/ai/load', {
    headers: { Authorization: `Bearer ${token}` }
  });
  saved = await res.json() || {};
} catch (err) {
  console.warn("Could not load AI state from server, falling back to local.");
  saved = JSON.parse(localStorage.getItem("cryptoAI_state")) || {};
}


if (saved.simulatedValue && saved.lastUpdated) {
    const diffSec = Math.floor((Date.now() - new Date(saved.lastUpdated)) / 5000);
    simulatedValue = saved.simulatedValue;
  
    for (let i = 0; i < diffSec; i++) {
      simulatedValue *= 1 + (Math.random() * 0.004 - 0.001); // +0.3% avg
    }
  }
  

  // Display updated value
  updateCryptoAIValueDisplay(simulatedValue, base);

  // Clear old rows and thoughts
  aiSimTable.innerHTML = "";
  aiThoughtsBox = document.getElementById("ai-thoughts") || createThoughtBox();

  const sentiments = [
    { mood: "Bullish", range: [0.05, 0.15], weight: 50 },   // +0.05% to +0.15%
    { mood: "Neutral", range: [0.00, 0.05], weight: 25 },   //  0% to +0.05%
    { mood: "Bearish", range: [-0.05, 0.00], weight: 25 }   // -0.05% to 0%
  ];
  

  function pickSentiment() {
    const totalWeight = sentiments.reduce((sum, s) => sum + s.weight, 0);
    let rand = Math.random() * totalWeight;
    for (let s of sentiments) {
      if (rand < s.weight) return s;
      rand -= s.weight;
    }
    return sentiments[0];
  }

  async function simulateTrade() {
    const sentiment = pickSentiment();
    const percent = (Math.random() * (sentiment.range[1] - sentiment.range[0]) + sentiment.range[0]);
    const direction = Math.random() < 0.5 ? -1 : 1;
    const changePercent = direction === -1 && sentiment.mood === "Bullish" ? percent * 0.5 : percent;
    const finalPercent = sentiment.mood === "Bearish" ? -Math.abs(changePercent) : Math.abs(changePercent);

    simulatedValue *= (1 + finalPercent / 100);
    const action = Math.random() > 0.5 ? "Buy" : "Sell";

    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="px-4 py-2">${new Date().toLocaleTimeString()}</td>
      <td class="px-4 py-2">${action}</td>
      <td class="px-4 py-2">${sentiment.mood}</td>
      <td class="px-4 py-2 ${finalPercent >= 0 ? 'text-green-400' : 'text-red-400'}">${finalPercent.toFixed(2)}%</td>
      <td class="px-4 py-2">$${simulatedValue.toFixed(2)}</td>
    `;
    aiSimTable.prepend(row);
    if (aiSimTable.rows.length > 20) aiSimTable.deleteRow(20);

    const token = localStorage.getItem("token");
    const body = JSON.stringify({
      simulatedValue,
      lastUpdated: new Date().toISOString()
    });
    
    try {
      await fetch('/api/ai/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body
      });
    } catch (err) {
      console.warn("Saving to MongoDB failed, falling back to localStorage.");
      localStorage.setItem("cryptoAI_state", body);
    }
    

    // Update display
    updateCryptoAIValueDisplay(simulatedValue, base);
    updateAIThought();
  }

  function updateAIThought() {
    const randomThought = thoughts[Math.floor(Math.random() * thoughts.length)];
    aiThoughtsBox.textContent = `🧠 ${randomThought}`;
  }

  clearInterval(aiSimInterval);
  aiSimInterval = setInterval(simulateTrade, 5000);
}

function updateCryptoAIValueDisplay(current, base) {
    const display = document.getElementById("cryptoai-value");
  
    const profit = current - base;
    const percent = (profit / base * 100).toFixed(2);
  
    display.innerHTML = `
      CryptoAI Profit: $${profit.toFixed(2)} 
      <span class="${profit >= 0 ? 'text-green-400' : 'text-red-400'}">
        (${profit >= 0 ? '↑' : '↓'} ${percent}%)
      </span>
    `;
  }
  

function createThoughtBox() {
  const box = document.createElement("div");
  box.id = "ai-thoughts";
  box.className = "text-center text-sm text-yellow-300 mt-2 italic";
  document.getElementById("ai-sim").appendChild(box);
  return box;
}


// Hook into tab switching
document.querySelectorAll('nav button[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.getAttribute('data-tab') === 'ai-sim') {
      setTimeout(startAiSimulation, 500); // small delay to allow TPV load
    } else {
      clearInterval(aiSimInterval);
    }
  });
});

window.addEventListener('DOMContentLoaded', async () => {
    await fetchCoinList();
    await loadUserName();
    await loadWallet();                     // ✅ ADD THIS
    loadMarketData();
    setInterval(loadMarketData, 10000);

    renderBuyHistory(); // ✅ add this to display the buy history on page load
});

// ✅ Buy Form Validation Logic (GLOBAL)
const buySymbolInput = document.getElementById('buy-symbol');
const buyAmountInput = document.getElementById('buy-amount');
const buySubmitBtn = document.getElementById('buy-submit');

function validateBuyForm() {
  const symbol = buySymbolInput.value.trim().toLowerCase();
  const usd = parseFloat(buyAmountInput.value);

  const match = coinList.find(c => c.symbol.toLowerCase() === symbol);
  const valid = match && !isNaN(usd) && usd > 0;

  buySubmitBtn.disabled = !valid;
  buySubmitBtn.classList.toggle('opacity-50', !valid);
}

buySymbolInput.addEventListener('input', validateBuyForm);
buyAmountInput.addEventListener('input', validateBuyForm);

// ✅ Buy Form Submission with backend request
document.getElementById('buy-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const symbol = buySymbolInput.value.trim().toLowerCase();
  const usd = parseFloat(buyAmountInput.value);
  const result = document.getElementById('buy-result');

  const coin = coinList.find(c => c.symbol.toLowerCase() === symbol);

  if (!coin) {
    result.textContent = '❌ Coin not found in CoinGecko list';
    result.style.color = 'red';
    return;
  }

  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coin.id}&vs_currencies=usd`);
    const priceData = await res.json();
    const price = priceData[coin.id]?.usd;

    if (!price) throw new Error('Price not found');

    const units = usd / price;
    const token = localStorage.getItem('token');

    // ✅ Send request to backend
    const submit = await fetch('/api/user/buy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({
        symbol: symbol.toUpperCase(),
        usd: usd.toFixed(2),
        amount: units.toFixed(6)
      })
    });

    const submitResult = await submit.json();

    if (!submit.ok) {
      result.textContent = '❌ ' + (submitResult.msg || 'Server error');
      result.style.color = 'red';
      return;
    }

    result.textContent = '✅ Buy request submitted and pending admin approval';
    result.style.color = 'limegreen';
    buySymbolInput.value = '';
    buyAmountInput.value = '';
    validateBuyForm();
  } catch (err) {
    result.textContent = '❌ Failed to submit buy request';
    result.style.color = 'red';
    console.error('❌ Error submitting request:', err);
  }
});
