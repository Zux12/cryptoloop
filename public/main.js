console.log("📦 main.js loaded");
let chartType = 'line'; // default view
let showVolume = true;



// 🔐 Redirect if not logged in
if (!localStorage.getItem('token')) {
  window.location.href = 'login.html';
}

// Global Variables
let coinList = [];
let watchlist = JSON.parse(localStorage.getItem('watchlist')) || [
  'bitcoin','ethereum','tether','binancecoin','usd-coin','ripple','cardano','solana',
  'dogecoin','polkadot','polygon','shiba-inu','tron','litecoin','avalanche-2','chainlink',
  'uniswap','cosmos','monero','stellar','bitcoin-cash','internet-computer','ethereum-classic',
  'vechain','filecoin','theta-token','aptos','hedera-hashgraph','tron','okb','chain',
  'toncoin','aave','algorand','zcash','itsecurities','axie-infinity','bitget-token',
  'near','kaspa','frax','pepe','render-token','the-graph','optimism','arbitrum',
  'internet-computer','stellar','filecoin','vechain','fantom','compound-governance-token',
  'avalanche','flow','klay-token','fantom','polygon','gala','sushiswap','enjincoin','zcash',
  'thorchain','quant-network','frax-share','kadena','neo','elrond-erd-2','dash','maker'
];

let aiSimInterval;
let aiSimTable;
let aiThoughtsBox;

// Handle Tab Switching
document.querySelectorAll('nav button[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
      document.querySelectorAll('nav button[data-tab]').forEach(b => b.classList.remove('active'));
  
      const tabId = btn.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
      btn.classList.add('active');
  
      // Hook into CryptoAI tab
      if (tabId === 'ai-sim') {
        setTimeout(startAiSimulation, 500); // Wait for TPV to load
      } else {
        clearInterval(aiSimInterval);
      }
    });
  });
  

// Logout
document.getElementById('logout').addEventListener('click', () => {
  localStorage.removeItem('token');
  window.location.href = 'login.html';
});

// Helper: safe JSON fetch that always sends token if present
async function fetchJSON(url, opts = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
  const res = await fetch(url, { ...opts, headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || res.statusText);
  }
  try { return JSON.parse(text); } catch { return text; }
}

// Load user name (resilient)
async function loadUserName() {
  const el = document.getElementById('welcome-user'); // make sure this exists in HTML
  if (!el) return;

  // 1) Immediate fallback from cache so UI never shows "undefined"
  const cachedName  = localStorage.getItem('userName')  || '';
  const cachedEmail = localStorage.getItem('userEmail') || '';
  if (cachedName || cachedEmail) {
    el.textContent = `Welcome, ${cachedName || cachedEmail.split('@')[0]} 👋`;
  } else {
    el.textContent = 'Welcome, Trader 👋';
  }

  // 2) Live fetch (prefer /api/user/me; fallback to /api/auth/me for compatibility)
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    let data;
    try {
      data = await fetchJSON('/api/user/me');
    } catch {
      // fallback if your backend exposes /api/auth/me instead
      data = await fetchJSON('/api/auth/me');
    }

    const name  = data.name || '';
    const email = data.email || '';

    // Cache for later sessions
    if (data.id)     localStorage.setItem('userId', data.id);
    if (name)        localStorage.setItem('userName', name);
    if (email)       localStorage.setItem('userEmail', email);

    el.textContent = `Welcome, ${name || (email ? email.split('@')[0] : 'Trader')} 👋`;
  } catch (err) {
    console.error('loadUserName failed:', err);
    // Keep the cached text we already set
  }
}

// Load Market Data
async function loadMarketData() {
  const table = document.querySelector('#market-table tbody');
  const localWallet = JSON.parse(localStorage.getItem('wallet')) || {}; // this is new aug6
  console.log("🔍 Retrieved wallet from localStorage in Market tab:", localWallet);

  if (!watchlist.length) {
    table.innerHTML = '<tr><td colspan="6" class="text-center text-gray-400">No coins in watchlist</td></tr>';
    return;
  }

  try {
    const ids = watchlist.join(',');
    const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}`);
    const prices = await res.json();

    table.innerHTML = prices.map(coin => {
      const symbol = coin.symbol.toLowerCase();
      const holding = localWallet[symbol] || 0;
      const holdingText = holding > 0 ? `${holding} ${coin.symbol.toUpperCase()}` : '–';
      console.log(`📊 ${coin.name} (${symbol}) → holding:`, holding);

      return `
        <tr>
          <td class="p-2 border text-blue-400 cursor-pointer hover:underline" onclick="setChartCoin('${coin.id}', '${coin.name}')">${coin.name}</td>
          <td class="p-2 border">${coin.symbol.toUpperCase()}</td>
          <td class="p-2 border">$${coin.current_price}</td>
          <td class="p-2 border ${coin.price_change_percentage_24h >= 0 ? 'text-green-400' : 'text-red-400'}">
            ${coin.price_change_percentage_24h.toFixed(2)}%
          </td>
          <td class="p-2 border">${coin.price_change_percentage_24h >= 0 ? '📈Up Trending' : '📉Down Trending'}</td>
          <td class="p-2 border">${holdingText}</td>
        </tr>
      `;
    }).join(''); // ✅ This was misplaced in your version

  } catch (err) {
    console.error('Error loading market data:', err);
    table.innerHTML = '<tr><td colspan="6" class="text-center text-red-500">Failed to load market data</td></tr>';
  }
}


// Load Wallet
async function loadWallet() {
  const token = localStorage.getItem('token');
  const table = document.querySelector('#wallet-table tbody');

  try {
    const res1 = await fetch('/api/user/wallet', {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res1.json();
    const wallet = data.wallet || {};
    console.log("👜 Loaded wallet from backend:", wallet);
    localStorage.setItem('wallet', JSON.stringify(wallet)); // ✅ Add this line here
    console.log("📦 Wallet saved to localStorage:", localStorage.getItem('wallet'));

    const symbols = Object.keys(wallet);
    if (!symbols.length) {
      table.innerHTML = '<tr><td colspan="6" class="text-center text-gray-400">No holdings</td></tr>';
      return;
    }

    const symbolToId = {
      btc: 'bitcoin',
      eth: 'ethereum',
      usdt: 'tether',
      bnb: 'binancecoin',
      ada: 'cardano',
      xrp: 'ripple',
      doge: 'dogecoin',
      sol: 'solana',
      trx: 'tron',
      trc: 'tron'
    };

    const ids = symbols.map(sym => symbolToId[sym]).filter(Boolean);
    console.log("🪙 CoinGecko IDs:", ids);

    let prices = [];
    try {
      const res2 = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids.join(',')}`);
      const contentType = res2.headers.get("content-type") || "";

      if (!res2.ok || !contentType.includes("application/json")) {
        throw new Error(`❌ CoinGecko error: status ${res2.status}`);
      }

      prices = await res2.json();
      if (!prices.length) throw new Error("🛑 No prices returned from CoinGecko");

    } catch (err) {
      console.error("❌ Error fetching CoinGecko prices:", err.message);
      if (table) {
        table.innerHTML = `<tr><td colspan="6" class="text-center text-red-500">${err.message}</td></tr>`;
      }
      return;
    }

    let totalValue = 0;
    const rows = prices.map(coin => {
      const symbol = coin.symbol.toLowerCase();
      const amount = wallet[symbol] || 0;
      const value = amount * coin.current_price;
      totalValue += value;
      return `
        <tr>
          <td class="p-2 border">${coin.name}</td>
          <td class="p-2 border">${symbol.toUpperCase()}</td>
          <td class="p-2 border">${amount}</td>
          <td class="p-2 border">$${coin.current_price}</td>
          <td class="p-2 border">$${value.toFixed(2)}</td>
          <td class="p-2 border">${((value / totalValue) * 100).toFixed(2)}%</td>
        </tr>
      `;
    });

    window.totalPortfolioValue = totalValue;
    document.getElementById('total-value').textContent = `Total Portfolio Value: $${totalValue.toFixed(2)}`;
    if (table) {
      table.innerHTML = rows.join('');
    }

  } catch (err) {
    console.error("❌ Error in loadWallet():", err.message);
    if (table) {
      table.innerHTML = `<tr><td colspan="6" class="text-center text-red-500">Error loading wallet</td></tr>`;
    }
  }
}


// TODO: Insert startAiSimulation() and simulateTrade() with clean logic later...
async function startAiSimulation() {
    const base = window.totalPortfolioValue;
  
    if (!base || base <= 0) {
      document.getElementById("cryptoai-value").textContent = "CryptoAI Profit: (not enough data)";
      return;
    }
  
    let simulatedValue = base;
    const saved = await loadCryptoAIStateFromDB(base);
    if (saved) simulatedValue = saved;
  
    updateCryptoAIValueDisplay(simulatedValue, base);
  
    aiSimTable = document.getElementById("ai-sim-table");
    aiThoughtsBox = document.getElementById("ai-thoughts") || createThoughtBox();
    aiSimTable.innerHTML = "";
  
    const thoughts = [
      "Analyzing ETH trends...",
      "High confidence in BTC rebound",
      "Monitoring whale activity...",
      "Slight dip — holding assets",
      "Scanning for entry points...",
      "News suggests caution — minor sell-off"
    ];
  
const sentiments = [
  { mood: "Bullish", range: [0.0001, 0.0003], weight: 30 },   
  { mood: "Neutral", range: [-0.00005, 0.0001], weight: 25 }, 
  { mood: "Bearish", range: [-0.0003, -0.0001], weight: 45 }  
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
  
      simulatedValue *= 1 + finalPercent / 100;
      const action = Math.random() > 0.5 ? "Buy" : "Sell";
  
      const row = document.createElement("tr");
      row.classList.add(action === "Buy" ? "flash-buy" : "flash-sell"); // 👈 add flash
      
      row.innerHTML = `
        <td class="px-4 py-2">${new Date().toLocaleTimeString()}</td>
        <td class="px-4 py-2">${action}</td>
        <td class="px-4 py-2">${sentiment.mood}</td>
        <td class="px-4 py-2 ${finalPercent >= 0 ? 'text-green-400' : 'text-red-400'}">${finalPercent}%</td>
        <td class="px-4 py-2">$${simulatedValue.toFixed(2)}</td>
      `;
      aiSimTable.prepend(row);
      if (aiSimTable.rows.length > 20) aiSimTable.deleteRow(20);
  
      updateCryptoAIValueDisplay(simulatedValue, base);
      updateAIThought(thoughts);
  
      await saveCryptoAIStateToDB(simulatedValue);
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
  
  function updateAIThought(thoughts) {
    if (!aiThoughtsBox) return;
    const randomThought = thoughts[Math.floor(Math.random() * thoughts.length)];
    aiThoughtsBox.textContent = `🧠 ${randomThought}`;
  }
  
  function createThoughtBox() {
    const box = document.createElement("div");
    box.id = "ai-thoughts";
    box.className = "text-center text-sm text-yellow-300 mt-2 italic";
    document.getElementById("ai-sim").appendChild(box);
    return box;
  }
  
//setchartcoin function
let currentChartSymbol = 'bitcoin';
let currentChartName = 'Bitcoin';

async function setChartCoin(symbol, name) {
  currentChartSymbol = symbol;
  currentChartName = name;

  document.getElementById("selected-coin-name").textContent = `${name}`;
  await loadChartData('1'); // Load 24h by default
  document.querySelector('[data-tab="chart"]').click(); // Switch to Chart tab
}

let chart;

console.log("📈 Loading chart type:", chartType);

async function loadChartData(days) {
  try {
    console.log("📈 Chart type:", chartType);

    const ctx = document.getElementById('cryptoChart').getContext('2d');
    if (chart) chart.destroy();

    if (chartType === 'line') {
      const res = await fetch(`https://api.coingecko.com/api/v3/coins/${currentChartSymbol}/market_chart?vs_currency=usd&days=${days}`);
      const data = await res.json();

      const labels = data.prices.map(p => new Date(p[0]).toLocaleTimeString());
      const values = data.prices.map(p => p[1]);

      chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: `${currentChartName} (${days}d)`,
            data: values,
            borderColor: 'green',
            borderWidth: 2,
            fill: false
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: true },
            zoom: {
              zoom: {
                wheel: { enabled: true },
                pinch: { enabled: true },
                mode: 'x'
              },
              pan: {
                enabled: true,
                mode: 'x'
              }
            }
          },
          scales: {
            y: {
              ticks: { color: 'white' },
              grid: { color: 'rgba(255,255,255,0.1)' }
            },
            x: {
              ticks: { color: 'white' },
              grid: { color: 'rgba(255,255,255,0.1)' }
            }
          }
        }
      });

    } else if (chartType === 'candlestick') {
      // Fetch OHLC
      const ohlcRes = await fetch(`https://api.coingecko.com/api/v3/coins/${currentChartSymbol}/ohlc?vs_currency=usd&days=${days}`);
      const ohlc = await ohlcRes.json();

      // Fetch volume data separately
      const volumeRes = await fetch(`https://api.coingecko.com/api/v3/coins/${currentChartSymbol}/market_chart?vs_currency=usd&days=${days}`);
      const volumeDataRaw = await volumeRes.json();

      const candleData = ohlc.map(d => ({
        x: d[0], // timestamp in ms
        o: d[1],
        h: d[2],
        l: d[3],
        c: d[4]
      }));

      const volumeData = volumeDataRaw.total_volumes.map(v => ({
        x: v[0],
        y: v[1]
      }));

// Prepare datasets separately
const datasets = [
  {
    label: `${currentChartName} (${days}d)`,
    data: candleData,
    borderColor: '#10b981',
    color: {
      up: '#10b981',
      down: '#ef4444',
      unchanged: '#d1d5db'
    },
    order: 1 // 🟢 Draw candles on top
  },
  ...(showVolume ? [{
    type: 'bar',
    label: 'Volume',
    data: volumeData,
    backgroundColor: 'rgba(100, 149, 237, 0.3)',
    yAxisID: 'volume',
    barPercentage: 0.5,
    categoryPercentage: 0.9,
    order: 0 // 🔵 Draw volume behind
  }] : [])
];

// Create the chart
chart = new Chart(ctx, {
  type: 'candlestick',
  data: {
    datasets: datasets
  },
  options: {
    responsive: true,
    plugins: {
      legend: { display: true },
      zoom: {
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'x'
        },
        pan: {
          enabled: true,
          mode: 'x'
        }
      }
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: days === '1' ? 'hour' : 'day'
        },
        ticks: { color: 'white' },
        grid: { color: 'rgba(255,255,255,0.1)' }
      },
      y: {
        position: 'left',
        title: { display: true, text: 'Price' },
        ticks: { color: 'white' },
        grid: { color: 'rgba(255,255,255,0.1)' }
      },
      volume: {
        position: 'right',
        title: { display: true, text: 'Volume' },
        ticks: {
          color: '#aaa',
          callback: value => (value / 1_000_000).toFixed(0) + 'M'
        },
        grid: { display: false },
        beginAtZero: true,
        display: true,
        weight: 0.2
      }
    }
  }
});

      
    }

  } catch (err) {
    console.error("❌ Error loading chart data:", err);
  }
}




function setChartRange(days, el) {
  loadChartData(days);

  // Highlight active button
  document.querySelectorAll('.chart-range-btn').forEach(btn => btn.classList.remove('active'));
  if (el) el.classList.add('active');
}


function resetZoom() {
  if (chart && chart.resetZoom) {
    chart.resetZoom();
  }
}

function toggleChartType() {
  chartType = chartType === 'line' ? 'candlestick' : 'line';

  // Update button label
  const btn = document.querySelector('button[onclick="toggleChartType()"]');
  btn.textContent = chartType === 'line' ? '🔁 Switch to Candlestick' : '🔁 Switch to Line Chart';

  // Reload chart with same days
  setChartRange('1', document.querySelector('.chart-range-btn.active'));
}



console.log("🧾 Rendering Buy History");

console.log("🧾 Rendering Buy History at", new Date().toLocaleTimeString());


//renderbuyhistory function
async function renderBuyHistory() {
  console.log("📡 Calling /api/user/buy/history");

  const token = localStorage.getItem("token");
  const body = document.getElementById("buy-history-body");
  if (!body) return;

  body.innerHTML = ''; // ✅ Clear before inserting new rows

  console.log("🖱️ Attaching edit/delete listeners...");

  try {
    const res = await fetch('/api/user/buy/history', {
      headers: { Authorization: `Bearer ${token}` }
    });

    const contentType = res.headers.get("content-type") || "";
    if (!res.ok || !contentType.includes("application/json")) {
      throw new Error("❌ Response not valid JSON");
    }

    const history = await res.json();
    if (!Array.isArray(history) || history.length === 0) {
      body.innerHTML = '<tr><td colspan="5" class="text-center text-gray-400">No buy history yet</td></tr>';
      return;
    }

    body.innerHTML = history.map(entry => `
      <tr>
        <td class="p-2 border">${entry.symbol.toUpperCase()}</td>
        <td class="p-2 border">$${entry.usd}</td>
        <td class="p-2 border">${entry.amount ? Number(entry.amount).toFixed(6) : '-'}</td>
        <td class="p-2 border">${entry.status}</td>


<td class="text-center">
  ${entry.status === 'Pending' ? `
    <div class="flex gap-2 justify-center">
      <button class="edit-btn inline-flex items-center bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium px-3 py-1 rounded-md shadow transition" data-id="${entry._id}">
        ✏️ Edit
      </button>
      <button class="delete-btn inline-flex items-center bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-3 py-1 rounded-md shadow transition" data-id="${entry._id}">
        🗑️ Delete
      </button>
    </div>
  ` : `
    <span class="text-gray-400 italic">Locked</span>
  `}
</td>

      </tr>
    `).join('');

    setTimeout(() => {
      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          if (confirm('❗ Delete this buy request?')) {
            try {
              const res = await fetch(`/api/user/buy/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
              });
              const result = await res.json();
              console.log("✅ Deleted:", result);
              renderBuyHistory();
            } catch (err) {
              console.error("❌ Delete failed:", err);
            }
          }
        });
      });

      document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const newUsd = prompt("✏️ New USD amount:");
          if (newUsd && !isNaN(newUsd) && parseFloat(newUsd) > 0) {
            try {
              const res = await fetch(`/api/user/buy/${id}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ usd: parseFloat(newUsd) })
              });
              const result = await res.json();
              console.log("✅ Edited:", result);
              renderBuyHistory();
            } catch (err) {
              console.error("❌ Edit failed:", err);
            }
          }
        });
      });
    }, 200);

  } catch (err) {
    console.error("❌ Error loading buy history:", err.message);
    body.innerHTML = '<tr><td colspan="5" class="text-center text-red-500">Failed to load buy history</td></tr>';
  }
}

//added due to multiple occurance in table
  



async function renderApprovedBuysForSelling() {
    const token = localStorage.getItem("token");
    const table = document.getElementById("sell-table-body");
  
    try {
      const res = await fetch('/api/user/approved-buys', {
        headers: { Authorization: `Bearer ${token}` }
      });
  
      const buys = await res.json();
      table.innerHTML = buys.map(buy => `
        <tr>
          <td class="p-2 border">${buy.symbol.toUpperCase()}</td>
          <td class="p-2 border">${buy.amount.toFixed(6)}</td>
          <td class="p-2 border">$${buy.usd.toFixed(2)}</td>
          <td class="p-2 border">${new Date(buy.timestamp).toLocaleString()}</td>
          <td class="p-2 border text-center">
            <button class="sell-btn bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded" data-id="${buy._id}" data-symbol="${buy.symbol}" data-max="${buy.amount}">
              Sell
            </button>
          </td>
          <td class="p-2 border text-center">Pending</td>
        </tr>
      `).join('');
  
      attachSellHandlers();
    } catch (err) {
      console.error("❌ Error loading approved buy history:", err);
      table.innerHTML = `<tr><td colspan="6" class="text-center text-red-500">Error loading approved buys</td></tr>`;
    }
  }

  



  function attachSellHandlers() {
    document.querySelectorAll('.sell-btn').forEach(button => {
      button.addEventListener('click', async () => {
        console.log("🟢 Sell button clicked:", { id, symbol, maxAmount });

        const id = button.dataset.id;
        const symbol = button.dataset.symbol;
        const maxAmount = parseFloat(button.dataset.max);
  
        const amount = parseFloat(prompt(`Enter amount to sell (Max: ${maxAmount}):`, maxAmount));
        if (isNaN(amount) || amount <= 0 || amount > maxAmount) {
          alert("❌ Invalid amount.");
          return;
        }
  
        const token = localStorage.getItem("token");
        try {
          const res = await fetch('/api/user/sell', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ id, symbol, amount })
          });
  
          console.log("📨 Sent to /api/user/sell:", { id, symbol, amount }); // ⬅️ HERE
          if (!res.ok) {
            console.warn("❌ Sell request failed:", await res.text());
            return;
          }

          const data = await res.json();
          alert(data.msg || "Sell request submitted.");
          renderApprovedBuysForSelling(); // refresh table
        } catch (err) {
          console.error("❌ Failed to submit sell:", err);
          alert("Error submitting sell request.");
        }
      });
    });
  }
  



 async function renderSellTable() {
  console.log("🟡 Running renderSellTable...");

  const token = localStorage.getItem("token");
  const body = document.querySelector("#sell-table-body");
  if (!body) return;

  try {
    const [walletRes, historyRes] = await Promise.all([
      fetch('/api/user/wallet', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/user/buy/history', { headers: { Authorization: `Bearer ${token}` } })
    ]);

    const walletContentType = walletRes.headers.get("content-type") || "";
    const historyContentType = historyRes.headers.get("content-type") || "";

    if (!walletRes.ok || !walletContentType.includes("application/json")) {
      throw new Error("❌ Wallet response was not valid JSON.");
    }

    if (!historyRes.ok || !historyContentType.includes("application/json")) {
      throw new Error("❌ Buy history response was not valid JSON.");
    }

    const walletData = await walletRes.json();
    const wallet = walletData.wallet || {};
    console.log("📦 Loaded wallet from backend:", wallet);

    const history = (await historyRes.json()).filter(e => e.status === 'Approved');
    console.log("📦 SellTable received buy history:", history.length, "records");

    body.innerHTML = ''; // Clear table body

    history.forEach(entry => {
      const symbol = entry.symbol.toLowerCase();
      const owned = wallet[symbol] || 0;

      console.log("🧾 Processing Approved entry:", `"${symbol}"`, owned);

      const row = document.createElement('tr');

      row.innerHTML = `
        <td class="p-2 border">${symbol.toUpperCase()}</td>
        <td class="p-2 border">${owned.toFixed(6)}</td>
        <td class="p-2 border">${entry.usd ? `$${entry.usd}` : '-'}</td>
        <td class="p-2 border">${new Date(entry.timestamp).toLocaleString()}</td>
        <td class="p-2 border text-center">
          <button class="sell-btn bg-yellow-500 text-white px-2 py-1 rounded" data-id="${entry._id}" data-symbol="${symbol}" data-amount="${owned}">Sell</button>
        </td>
        <td class="p-2 border">Pending</td>
      `;

      body.appendChild(row);
    });

    // 🔁 Attach event listeners AFTER the table is populated
    document.querySelectorAll(".sell-btn").forEach(button => {
      button.addEventListener("click", async () => {
        const id = button.dataset.id;
        const symbol = button.dataset.symbol;
        const maxAmount = Number(button.dataset.amount);

        console.log("⚡ Sell button clicked:", { id, symbol, maxAmount });

        const input = prompt(`Enter amount to sell (max ${maxAmount}):`);
        if (!input || isNaN(input)) {
          alert("❌ Invalid amount.");
          return;
        }

        const value = Number(input);
        if (value > maxAmount) {
          alert("❌ Cannot sell more than you own.");
          return;
        }

        const res = await fetch('/api/user/sell', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ id, symbol, amount: value })
        });

        const data = await res.json();
        console.log("✅ Sell request submitted:", data);
        alert(data.msg || 'Sell request submitted!');
        renderApprovedBuysForSelling(); // refresh list
      });
    });

  } catch (err) {
    console.error("❌ Error rendering Sell Table:", err.message);
    body.innerHTML = `<tr><td colspan="6" class="text-red-500 text-center p-4">${err.message}</td></tr>`;
  }
}




  
  
async function loadCryptoNews() {
  const newsBox = document.getElementById('crypto-news');
  if (!newsBox) return;

  // show loading state
  newsBox.innerHTML = '<li class="text-gray-400 italic">Loading news...</li>';

  try {
    const lastFetch = localStorage.getItem('cryptoNewsFetchedAt');
    const cached = localStorage.getItem('cryptoNewsCached');
    const now = Date.now();

    // ✅ If within 24 hours, serve cached news
    if (cached && lastFetch && now - parseInt(lastFetch) < 86400000) {
      const articles = JSON.parse(cached);
      renderNews(articles, newsBox);
      return;
    }

    // ✅ Otherwise, fetch fresh
    const res = await fetch("/api/news");
    const articles = await res.json();

    // store for reuse
    localStorage.setItem("cryptoNewsFetchedAt", now.toString());
    localStorage.setItem("cryptoNewsCached", JSON.stringify(articles));

    renderNews(articles, newsBox);
  } catch (err) {
    console.error("❌ Failed to load crypto news:", err);
    newsBox.innerHTML = '<li class="text-red-400">Failed to load news.</li>';
  }
}

//helper function for above script
function renderNews(articles, newsBox) {
  newsBox.innerHTML = articles.map(article => `
    <li class="bg-gray-800 p-3 rounded-lg shadow-md hover:bg-gray-700 transition">
      <a href="${article.url}" target="_blank" class="block text-sm text-blue-400 hover:underline">
        <span class="font-semibold text-white">${article.source.name}</span>: ${article.title.slice(0, 100)}...
      </a>
    </li>
  `).join('');
}


function toggleVolume() {
  showVolume = !showVolume;

  const button = document.querySelector('button[onclick="toggleVolume()"]');
  button.textContent = showVolume ? '📉 Hide Volume' : '📈 Show Volume';

  // Reload chart to reflect change
  const activeBtn = document.querySelector('.chart-range-btn.active');
  const days = activeBtn ? activeBtn.textContent.replace(/[^\d]/g, '') : '1';
  setChartRange(days, activeBtn);
}














(() => {
    const oldForm = document.getElementById('buy-form');
  
    // ✅ Fully clone and replace the form node to drop all existing listeners
    const newForm = oldForm.cloneNode(true);
    oldForm.replaceWith(newForm);
  
   
  })();
  

//add coin
// 🔄 Add coin logic
document.getElementById("add-coin").addEventListener("click", () => {
    const input = document.getElementById("new-coin-input");
    const symbol = input.value.trim().toLowerCase();
    if (!symbol) return;
  
    let coins = JSON.parse(localStorage.getItem("marketCoins") || "[]");
  
    if (!coins.includes(symbol)) {
      coins.push(symbol);
      localStorage.setItem("marketCoins", JSON.stringify(coins));
      loadMarketData(); // refresh market
    }
  
    input.value = ""; // clear input field
  });
  
//end add coin  
  
async function loadCryptoAIStateFromDB(base) {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch('/api/ai/load', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const saved = await res.json();
      if (saved?.simulatedValue && saved?.lastUpdated) {
        const elapsed = Math.floor((Date.now() - new Date(saved.lastUpdated)) / 5000);
        let value = saved.simulatedValue;
        for (let i = 0; i < elapsed; i++) {
          value *= 1 + (Math.random() * 0.000004 - 0.000001); // small passive gain to 60% over 30 days
        }
        return value;
      }
      return base;
    } catch (err) {
      console.warn("Failed to load from MongoDB. Using base.");
      return base;
    }
  }
  
  async function saveCryptoAIStateToDB(simulatedValue) {
    try {
      const token = localStorage.getItem("token");
      await fetch('/api/ai/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          simulatedValue,
          lastUpdated: new Date().toISOString()
        })
      });
    } catch (err) {
      console.warn("Failed to save AI state to MongoDB.");
    }
  }
  
  const buyForm = document.getElementById('buy-form');
if (buyForm && !buyForm.hasSubmitListener) {
  buyForm.hasSubmitListener = true;


}

 window.addEventListener('DOMContentLoaded', () => {
    const buyForm = document.getElementById('buy-form');
    if (!buyForm) return;
  
    
  });
  

  const buySymbolInput = document.getElementById("buy-symbol");
const buyAmountInput = document.getElementById("buy-amount");
const buySubmitBtn = document.getElementById("buy-submit");

function checkBuyFormValidity() {
  const symbol = buySymbolInput.value.trim();
  const amount = parseFloat(buyAmountInput.value);
  const valid = symbol && !isNaN(amount) && amount > 0;

  buySubmitBtn.disabled = !valid;
  buySubmitBtn.classList.toggle("opacity-50", !valid);
}

// Attach live input validation
buySymbolInput.addEventListener("input", checkBuyFormValidity);
buyAmountInput.addEventListener("input", checkBuyFormValidity);


//paste this Once

let buyFormBound = false;

function setupBuyForm() {
  if (buyFormBound) return;
  buyFormBound = true;

  const buyForm = document.getElementById('buy-form');
  if (!buyForm) return;

 
}

function clearAndBindBuyFormOnce() {
    const oldForm = document.getElementById("buy-form");
    const newForm = oldForm.cloneNode(true); // clears old listeners
    oldForm.replaceWith(newForm);
  
    newForm.addEventListener("submit", async function (e) {
      e.preventDefault();
  
      const symbol = document.getElementById('buy-symbol').value.trim().toLowerCase();
      const usd = parseFloat(document.getElementById('buy-amount').value);
      const resultBox = document.getElementById('buy-result');
  
      console.log("🔍 Submitted symbol:", symbol);
      console.log("🔍 Submitted USD:", usd);
  
      if (!symbol || isNaN(usd) || usd <= 0) {
        resultBox.textContent = "❌ Invalid input.";
        return;
      }
  
      const token = localStorage.getItem("token");
  
      try {
        const res = await fetch('/api/user/buy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ symbol, usd })
        });
  
        const data = await res.json();
        resultBox.textContent = `✅ Buy request submitted. Status: ${data.status || 'pending'}`;
        setTimeout(renderBuyHistory, 300); // short delay for DB write
      } catch (err) {
        resultBox.textContent = "❌ Failed to submit buy request.";
        console.error(err);
      }
    });
  }
  

  function checkBuyFormValidity() {
    const symbol = document.getElementById("buy-symbol").value.trim();
    const usd = parseFloat(document.getElementById("buy-amount").value);
    const submitBtn = document.getElementById("buy-submit");
  
    if (symbol && !isNaN(usd) && usd > 0) {
      submitBtn.disabled = false;
      submitBtn.classList.remove("opacity-50");
    } else {
      submitBtn.disabled = true;
      submitBtn.classList.add("opacity-50");
    }
  }
  

  //function remove coin
  function removeCoin(symbol) {
    const coins = JSON.parse(localStorage.getItem("marketCoins") || "[]");
    const updated = coins.filter(c => c !== symbol.toLowerCase());
    localStorage.setItem("marketCoins", JSON.stringify(updated));
    loadMarketData(); // refresh market
  }
  
  // 🟣 Fetch and Render Sell History
async function renderSellHistory() {
    const token = localStorage.getItem('token');
    const body = document.getElementById('sell-history-body');
    if (!body) return;
  
    try {
      const res = await fetch('/api/user/sell/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
  
      if (!res.ok) throw new Error("❌ Failed to fetch sell history");
  
      const history = await res.json();
      if (!Array.isArray(history) || !history.length) {
        body.innerHTML = '<tr><td colspan="4" class="text-center text-gray-400 p-4">No past sell records found.</td></tr>';
        return;
      }
  
      body.innerHTML = history.map(entry => `
        <tr>
          <td class="p-2 border">${entry.symbol.toUpperCase()}</td>
          <td class="p-2 border">${Number(entry.amount).toFixed(6)}</td>
          <td class="p-2 border">${entry.status}</td>
          <td class="p-2 border">${new Date(entry.timestamp).toLocaleString()}</td>
        </tr>
      `).join('');
    } catch (err) {
      console.error("❌ Error loading sell history:", err.message);
      body.innerHTML = '<tr><td colspan="4" class="text-red-400 p-4 text-center">Failed to load sell history</td></tr>';
    }
  }
  
  // 🟢 Load and render full Sell History
async function loadSellHistoryTable() {
    const token = localStorage.getItem("token");
    const body = document.getElementById("sell-history-body");
    if (!body) return;
  
    try {
      const res = await fetch('/api/user/sell/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
  
      const history = await res.json();
      console.log("📜 Loaded full sell history:", history);
  
      if (!history.length) {
        body.innerHTML = '<tr><td colspan="5" class="text-center text-gray-400">No sell history</td></tr>';
        return;
      }
  
      body.innerHTML = history.map(entry => `
        <tr>
          <td class="p-2 border">${entry.symbol.toUpperCase()}</td>
          <td class="p-2 border">${entry.amount}</td>
          <td class="p-2 border">${entry.status}</td>
          <td class="p-2 border">${new Date(entry.timestamp).toLocaleString()}</td>
          <td class="p-2 border">${entry._id}</td>
        </tr>
      `).join('');
  
    } catch (err) {
      console.error("❌ Error loading sell history:", err);
      body.innerHTML = '<tr><td colspan="5" class="text-center text-red-500">Error loading sell history</td></tr>';
    }
  }
  




// Initialize on load
window.onload = function () {
  loadUserName();
  loadMarketData();
  loadWallet();
  loadCryptoNews();
  renderBuyHistory(); // ✅ Add this
  renderSellTable(); // ✅ Now added here
  loadSellHistoryTable();  // ✅ THIS LINE
  renderApprovedBuysForSelling(); // optional for Sell tab
  clearAndBindBuyFormOnce(); // ✅ one and only buy form bind
  document.getElementById("buy-symbol").addEventListener("input", checkBuyFormValidity);
document.getElementById("buy-amount").addEventListener("input", checkBuyFormValidity);

};
