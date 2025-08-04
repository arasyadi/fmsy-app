// Variabel global untuk menyimpan data dari JSON
let speciesDatabase = {};
let classificationRules = {};

// Variabel state aplikasi lainnya
let csvLengths = [];
let chartData = [];
let myChart = null;
let predictedAges = [];
let currentSpecies = null;

// Fungsi untuk memuat data JSON saat halaman dimuat
async function loadDatabases() {
  try {
    const [speciesResponse, rulesResponse] = await Promise.all([
      fetch('species_database.json'),
      fetch('classification_rules.json')
    ]);
    speciesDatabase = await speciesResponse.json();
    classificationRules = await rulesResponse.json();
    console.log("Database berhasil dimuat.");
    initializeApp();
  } catch (error) {
    console.error("Gagal memuat file database:", error);
    alert("Gagal memuat data konfigurasi. Beberapa fitur mungkin tidak berfungsi.");
  }
}

// Fungsi inisialisasi aplikasi setelah data dimuat
function initializeApp() {
  // Event listener untuk input spesies
  document.getElementById("species").addEventListener("input", function(e) {
    const query = e.target.value.toLowerCase();
    const suggestionsContainer = document.getElementById("species-suggestions");
    suggestionsContainer.innerHTML = '';
    
    if (query.length < 2) {
      suggestionsContainer.style.display = 'none';
      return;
    }
    
    const matches = Object.keys(speciesDatabase).filter(species => 
      species.toLowerCase().includes(query)
    ).slice(0, 5);
    
    if (matches.length) {
      matches.forEach(species => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.textContent = species;
        div.onclick = () => {
          document.getElementById('species').value = species;
          suggestionsContainer.style.display = 'none';
          currentSpecies = species;
          if (speciesDatabase[species]) {
            document.getElementById('linf').value = speciesDatabase[species].linf;
            document.getElementById('k').value = speciesDatabase[species].k;
          }
        };
        suggestionsContainer.appendChild(div);
      });
      suggestionsContainer.style.display = 'block';
    } else {
      suggestionsContainer.style.display = 'none';
    }
  });

  // Event listener lainnya
  document.addEventListener('click', function(e) {
    if (e.target.id !== 'species') {
      document.getElementById('species-suggestions').style.display = 'none';
    }
  });

  document.getElementById("csvInput").addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;
    
    document.getElementById("fileName").textContent = file.name;
    
    const reader = new FileReader();
    reader.onload = function (event) {
      const lines = event.target.result.split(/\r?\n/);
      csvLengths = lines.map(l => parseFloat(l.trim())).filter(v => !isNaN(v));
      updateStatistics();
    };
    reader.readAsText(file);
  });
  
  // Inisialisasi statistik awal
  updateStatistics();
}


// ====================================================================
// FUNGSI YANG DIMODIFIKASI
// ====================================================================

// Fungsi getClassification sekarang membaca dari data 'classificationRules'
function getClassification(panjang, species) {
  // Tentukan aturan mana yang akan digunakan: spesifik spesies atau default
  const rules = classificationRules[species] || classificationRules['default'];

  if (rules) {
    for (const rule of rules) {
      // Periksa apakah panjang berada dalam rentang min (inklusif) dan max (eksklusif)
      if (panjang >= rule.min && panjang < rule.max) {
        return rule.phase;
      }
    }
  }

  return 'Klasifikasi tidak ditemukan'; // Fallback
}


// ====================================================================
// FUNGSI YANG TETAP SAMA
// ====================================================================

function calculatePercentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p / 100;
  const lower = Math.floor(index);
  const fraction = index - lower;
  
  if (lower + 1 < sorted.length) {
    return sorted[lower] + fraction * (sorted[lower + 1] - sorted[lower]);
  } else {
    return sorted[lower];
  }
}

function calculateStatistics(data) {
  if (data.length === 0) {
    return { count: 0, min: 0, max: 0, avg: 0, median: 0, mode: 0, stdDev: 0, variance: 0, q1: 0, q2: 0, q3: 0, range: 0 };
  }
  const sorted = [...data].sort((a, b) => a - b);
  const count = sorted.length;
  const min = sorted[0];
  const max = sorted[count - 1];
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = sum / count;
  const median = calculatePercentile(sorted, 50);
  const q1 = calculatePercentile(sorted, 25);
  const q3 = calculatePercentile(sorted, 75);
  const frequencyMap = {};
  let maxFreq = 0;
  let mode = sorted[0];
  sorted.forEach(val => {
    frequencyMap[val] = (frequencyMap[val] || 0) + 1;
    if (frequencyMap[val] > maxFreq) {
      maxFreq = frequencyMap[val];
      mode = val;
    }
  });
  const variance = sorted.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / count;
  const stdDev = Math.sqrt(variance);
  const range = max - min;
  return { count, min, max, avg, median, mode, stdDev, variance, q1, q2: median, q3, range };
}

function updateStatistics() {
  const stats = calculateStatistics(csvLengths);
  document.getElementById("sampleCount").textContent = stats.count;
  document.getElementById("minLength").textContent = stats.min.toFixed(2);
  document.getElementById("maxLength").textContent = stats.max.toFixed(2);
  document.getElementById("avgLength").textContent = stats.avg.toFixed(2);
  document.getElementById("median").textContent = stats.median.toFixed(2);
  document.getElementById("mode").textContent = stats.mode.toFixed(2);
  document.getElementById("stdDev").textContent = stats.stdDev.toFixed(2);
  document.getElementById("variance").textContent = stats.variance.toFixed(2);
  document.getElementById("q1").textContent = stats.q1.toFixed(2);
  document.getElementById("q2").textContent = stats.q2.toFixed(2);
  document.getElementById("q3").textContent = stats.q3.toFixed(2);
  document.getElementById("range").textContent = stats.range.toFixed(2);
}

function showLoading(show) {
  document.getElementById("loadingIndicator").style.display = show ? "block" : "none";
}

function calculateGrowth() {
  const linf = parseFloat(document.getElementById("linf").value);
  const k = parseFloat(document.getElementById("k").value);
  const species = document.getElementById("species").value;
  if (!linf || !k) {
    alert("Mohon isi parameter L∞ dan K terlebih dahulu!");
    return;
  }
  if (csvLengths.length === 0) {
    alert("Silakan unggah file CSV dengan data panjang Teripang (cm)!");
    return;
  }
  showLoading(true);
  currentSpecies = species;
  setTimeout(() => {
    processCalculation(linf, k);
    showLoading(false);
  }, 1000);
}

function processCalculation(linf, k) {
  const lengths = csvLengths;
  const tableBody = document.querySelector("#resultTable tbody");
  const tableFooter = document.getElementById("tableFooter");
  const regressionInfo = document.getElementById("regressionResult");
  tableBody.innerHTML = "";
  regressionInfo.innerHTML = "";
  chartData = [];
  predictedAges = [];
  const regressionData = [];
  const displayCount = Math.min(lengths.length, 30);
  for (let i = 0; i < lengths.length; i++) {
    const Lt = lengths[i];
    const t = -(1 / k) * Math.log(1 - (Lt / linf));
    const Lt1 = linf * (1 - Math.exp(-k * (t + 1)));
    predictedAges.push(t);
    regressionData.push([Lt, Lt1]);
    chartData.push({ x: t * 12, y: Lt });
    if (i < displayCount) {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${Lt.toFixed(2)}</td><td>${t.toFixed(3)}</td><td>${(t*12).toFixed(1)}</td><td>${Lt1.toFixed(2)}</td>`;
      tableBody.appendChild(row);
    }
  }
  if (lengths.length > displayCount) {
    tableFooter.style.display = "";
    tableFooter.querySelector(".pagination-info").textContent = `Menampilkan ${displayCount} dari ${lengths.length} data. Gunakan "Download Hasil" untuk melihat semua data.`;
  } else {
    tableFooter.style.display = "none";
  }
  const result = regression.linear(regressionData);
  const slope = result.equation[0];
  const intercept = result.equation[1];
  const r2 = result.r2;
  regressionInfo.innerHTML = `<div class="info-box"><i class="fas fa-chart-line"></i><strong>Hasil Regresi Linear</strong><br>Persamaan: y = ${slope.toFixed(4)}x + ${intercept.toFixed(4)}<br>Koefisien Determinasi (R²) = ${r2.toFixed(4)}</div>`;
  updateAgeStatistics();
  document.getElementById("downloadChartBtn").style.display = "block";
  const avgLength = csvLengths.reduce((a, b) => a + b, 0) / csvLengths.length;
  const avgAge = predictedAges.reduce((a, b) => a + b, 0) / predictedAges.length;
  const classification = getClassification(avgLength, currentSpecies);
  let interpretationText = `Hasil menunjukkan bahwa ukuran rata-rata teripang yang tertangkap adalah sekitar ${avgLength.toFixed(2)} cm. Dengan menggunakan model pertumbuhan, diperkirakan rata-rata usia teripang pada ukuran tersebut adalah ${avgAge.toFixed(2)} tahun. Berdasarkan literatur, kemungkinan besar teripang yang anda tangkap adalah tergolong ${classification}.`;
  if (currentSpecies && speciesDatabase[currentSpecies]) {
    const speciesData = speciesDatabase[currentSpecies];
    interpretationText = `<strong>Spesies: ${currentSpecies} (${speciesData.commonName})</strong><br>${speciesData.description}<br><br>${interpretationText}`;
  }
  document.getElementById("interpretationResult").innerHTML = interpretationText;
  document.getElementById("interpretationCard").style.display = "block";
  renderChart(linf, k);
}

function renderChart(linf, k) {
  const ctx = document.getElementById("regressionChart").getContext("2d");
  if (myChart) {
    myChart.destroy();
  }
  chartData.sort((a, b) => a.x - b.x);
  const maxAge = Math.max(...chartData.map(d => d.x));
  const regressionLine = [];
  for (let ageInMonths = 0; ageInMonths <= maxAge; ageInMonths += 1) {
    const ageInYears = ageInMonths / 12;
    const length = linf * (1 - Math.exp(-k * ageInYears));
    regressionLine.push({ x: ageInMonths, y: length });
  }
  myChart = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Data Panjang vs Usia',
        data: chartData,
        backgroundColor: 'rgba(44, 111, 187, 0.7)',
        pointRadius: 5,
        pointHoverRadius: 7
      }, {
        label: 'Kurva Pertumbuhan Von Bertalanffy',
        data: regressionLine,
        borderColor: 'rgba(220, 53, 69, 0.8)',
        borderWidth: 3,
        fill: false,
        pointRadius: 0,
        showLine: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: 'Usia (bulan)' }, type: 'linear', position: 'bottom' },
        y: { title: { display: true, text: 'Panjang (cm)' } }
      },
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: function(context) {
              const point = context.raw;
              return `Panjang: ${point.y.toFixed(2)} cm, Usia: ${point.x.toFixed(1)} bulan`;
            }
          }
        }
      }
    }
  });
}

function downloadChart() {
  if (!myChart) {
    alert("Tidak ada grafik yang tersedia untuk diunduh!");
    return;
  }
  const canvas = document.getElementById("regressionChart");
  const imageLink = document.createElement('a');
  imageLink.download = 'visualisasi_pertumbuhan_teripang.png';
  imageLink.href = canvas.toDataURL('image/png');
  imageLink.click();
}

function downloadCSV() {
  if (csvLengths.length === 0 || predictedAges.length === 0) {
    alert("Tidak ada data untuk diunduh. Silakan hitung prediksi terlebih dahulu.");
    return;
  }
  let csvContent = "Panjang (cm),Usia (tahun),Usia (bulan),Prediksi Lt+1 (cm)\n";
  const linf = parseFloat(document.getElementById("linf").value);
  const k = parseFloat(document.getElementById("k").value);
  for (let i = 0; i < csvLengths.length; i++) {
    const Lt = csvLengths[i];
    const t = predictedAges[i];
    const tMonths = t * 12;
    const Lt1 = linf * (1 - Math.exp(-k * (t + 1)));
    csvContent += `${Lt.toFixed(2)},${t.toFixed(3)},${tMonths.toFixed(1)},${Lt1.toFixed(2)}\n`;
  }
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", "prediksi_usia_teripang.csv");
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function updateAgeStatistics() {
  if (predictedAges.length === 0) return;
  const stats = calculateStatistics(predictedAges);
  document.getElementById("ageSampleCount").textContent = stats.count;
  document.getElementById("minAge").textContent = stats.min.toFixed(3);
  document.getElementById("maxAge").textContent = stats.max.toFixed(3);
  document.getElementById("avgAge").textContent = stats.avg.toFixed(3);
  document.getElementById("ageMedian").textContent = stats.median.toFixed(3);
  document.getElementById("ageMode").textContent = stats.mode.toFixed(3);
  document.getElementById("ageStdDev").textContent = stats.stdDev.toFixed(3);
  document.getElementById("ageVariance").textContent = stats.variance.toFixed(3);
  document.getElementById("ageQ1").textContent = stats.q1.toFixed(3);
  document.getElementById("ageQ2").textContent = stats.q2.toFixed(3);
  document.getElementById("ageQ3").textContent = stats.q3.toFixed(3);
  document.getElementById("ageRange").textContent = stats.range.toFixed(3);
  document.getElementById("ageStatsCard").style.display = "block";
}

function resetForm() {
  document.getElementById("linf").value = "30.66";
  document.getElementById("k").value = "0.34";
  document.getElementById("species").value = "";
  document.getElementById("csvInput").value = "";
  document.getElementById("fileName").textContent = "Belum ada file dipilih";
  document.querySelector("#resultTable tbody").innerHTML = "";
  document.getElementById("regressionResult").innerHTML = "";
  document.getElementById("ageStatsCard").style.display = "none";
  document.getElementById("interpretationCard").style.display = "none";
  document.getElementById("downloadChartBtn").style.display = "none";
  document.getElementById("tableFooter").style.display = "none";
  csvLengths = [];
  predictedAges = [];
  currentSpecies = null;
  updateStatistics();
  if (myChart) {
    myChart.destroy();
    myChart = null;
  }
}

// Panggil fungsi untuk memuat database saat skrip pertama kali dijalankan
loadDatabases();