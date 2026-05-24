const https = require('https');

async function generateChartBuffer(sig, candles) {
    return new Promise((resolve, reject) => {
        // Take last 60 candles for context
        const recentCandles = candles.slice(-60);
        
        const dataPoints = recentCandles.map(c => ({
            x: c.t.getTime(),
            o: c.o,
            h: c.h,
            l: c.l,
            c: c.c
        }));

        const isLong = sig.dir === 'LONG';
        const colorUp = 'rgba(14, 203, 129, 0.8)';
        const colorDown = 'rgba(246, 70, 93, 0.8)';

        const chartConfig = {
            type: 'candlestick',
            data: {
                datasets: [{
                    label: sig.sym,
                    data: dataPoints,
                    color: {
                        up: colorUp,
                        down: colorDown,
                        unchanged: '#848e9c'
                    }
                }]
            },
            options: {
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: `${sig.sym} - ${sig.tf} - ${sig.dir}`,
                        color: '#eaecef',
                        font: { size: 16 }
                    },
                    annotation: {
                        annotations: {
                            entryZone: {
                                type: 'box',
                                yMin: sig.entryLow,
                                yMax: sig.entryHigh,
                                backgroundColor: isLong ? 'rgba(14, 203, 129, 0.2)' : 'rgba(246, 70, 93, 0.2)',
                                borderWidth: 0
                            },
                            slLine: {
                                type: 'line',
                                yMin: sig.sl,
                                yMax: sig.sl,
                                borderColor: '#f6465d',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                label: { content: 'SL', display: true, position: 'start', backgroundColor: '#f6465d' }
                            },
                            tp1Line: {
                                type: 'line',
                                yMin: sig.tp1,
                                yMax: sig.tp1,
                                borderColor: '#0ecb81',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                label: { content: 'TP1', display: true, position: 'start', backgroundColor: '#0ecb81' }
                            },
                            tp2Line: {
                                type: 'line',
                                yMin: sig.tp2,
                                yMax: sig.tp2,
                                borderColor: '#0ecb81',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                label: { content: 'TP2', display: true, position: 'start', backgroundColor: '#0ecb81' }
                            },
                            tp3Line: {
                                type: 'line',
                                yMin: sig.tp3,
                                yMax: sig.tp3,
                                borderColor: '#0ecb81',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                label: { content: 'TP3', display: true, position: 'start', backgroundColor: '#0ecb81' }
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        ticks: { color: '#848e9c' },
                        grid: { color: '#2b3139' }
                    },
                    y: {
                        position: 'right',
                        ticks: { color: '#848e9c' },
                        grid: { color: '#2b3139' }
                    }
                }
            }
        };

        const postData = JSON.stringify({
            version: '3',
            chart: chartConfig,
            width: 800,
            height: 450,
            backgroundColor: '#161a1e'
        });

        const req = https.request('https://quickchart.io/chart', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            if (res.statusCode !== 200) {
                return reject(new Error('QuickChart failed with status ' + res.statusCode));
            }
            let chunks = [];
            res.on('data', (d) => chunks.push(d));
            res.on('end', () => {
                resolve(Buffer.concat(chunks));
            });
        });

        req.on('error', (e) => reject(e));
        req.write(postData);
        req.end();
    });
}

module.exports = { generateChartBuffer };
