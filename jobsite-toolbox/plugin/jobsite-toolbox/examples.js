// One worked example per tool, for the "帶入範例" button and as shared test data.
// `expect` holds values worked out independently from each spec's cited example (not copied from
// calculations.js output). Example material parameters are demonstrations, never product defaults.
globalThis.toolboxExamples = {
  slab: {
    note: 'QUIKRETE 教材例 20 × 30 ft、厚 4 in 換成公制（約 7.407 yd³）；每袋產率 0.017 m³ 為示範值。',
    values: { length: 6.096, width: 9.144, thickness: 101.6, yieldPerBag: 0.017 },
    expect: { volume: 5.6633693, bags: 334 },
  },
  hole: {
    note: '示範值：孔徑 300 mm、深 1.2 m、8 孔，每袋產率 0.017 m³（規格尚無原廠數例）。',
    values: { diameter: 0.3, depth: 1.2, count: 8, yieldPerBag: 0.017 },
    expect: { perHole: 0.0848230, volume: 0.6785840, bags: 40 },
  },
  sealant: {
    note: '規格例：淨量 15,000 mL、每支 320 mL、損耗 20%（有效容量減少口徑）→ 59 支。',
    values: { length: 150, width: 10, depth: 10, capacity: 320, loss: 20 },
    expect: { net: 15000, effective: 256, cartridges: 59 },
  },
  aggregate: {
    note: '規格例：5 m² × 0.1 m ＝ 0.5 m³；未填密度就不顯示重量。',
    values: { length: 5, width: 1, thickness: 100 },
    expect: { volume: 0.5 },
  },
  rebar: {
    note: '示範值：單位重 1 kg/m、每支 12 m、10 支；實際請填型錄單位重。',
    values: { unitWeight: 1, length: 12, count: 10 },
    expect: { totalLength: 120, mass: 120 },
  },
  plate: {
    note: '規格例：1 × 1 m、厚 10 mm、密度 7,850 kg/m³ → 每件 78.5 kg、2 件 157 kg。',
    values: { length: 1, width: 1, thickness: 10, density: 7850, count: 2 },
    expect: { perPiece: 78.5, mass: 157 },
  },
  tile: {
    note: '規格例：2 × 3 m 地面、300 × 300 mm 磚（未含備料）≈ 66.67 片；每箱 10 片為示範值。',
    values: { length: 2, width: 3, tileLength: 300, tileWidth: 300, perBox: 10 },
    expect: { rawTiles: 66.666667, tiles: 67, boxes: 7 },
  },
  tileLayout: {
    note: 'TilePro 實測：65 × 60 cm 牆、60 × 60 cm 磚、3 mm 縫、靠左起排 → 尾片 4.7 cm。',
    values: { width: 650, height: 600, tileWidth: 600, tileHeight: 600, joint: 3, mode: 'edge' },
    expect: { moduleX: 603, fullTiles: 1, cutPieces: 1, totalPieces: 2 },
  },
  adhesive: {
    note: 'ARDEX UK X 77 例：2 mm 床厚 × 1.05 kg/m²/mm ＝ 2.1 kg/m²，10 m²、20 kg/包 → 21 kg、2 包。',
    values: { area: 10, product: '範例：ARDEX X 77（英國）', source: '範例：英國技術表 1.05 kg/m²/mm × 2 mm', rate: 2.1, bagWeight: 20, allowance: 0 },
    expect: { mass: 21, rawBags: 1.05, bags: 2 },
  },
  grout: {
    note: 'MAPEI 用量式例：300 × 300 mm 磚、縫深 10 mm、縫寬 3 mm → 0.2 L/m²；密度 1.6 kg/L、每包 5 kg 為示範值。',
    values: { area: 10, tileLength: 300, tileWidth: 300, depth: 10, joint: 3, density: 1.6, allowance: 0, bagWeight: 5 },
    expect: { litresPerSquareMetre: 0.2, mass: 3.2, bags: 1 },
  },
  gypsum: {
    note: 'USG 手冊例：100 ft²（9.29 m²）→ 接縫帶約 37 ft（11.28 m）；1220 × 2440 mm 板為示範值。',
    values: { area: 9.290304, boardLength: 2440, boardWidth: 1220, tapeRate: 1.2139 },
    expect: { rawBoards: 3.1209030, boards: 4, tape: 11.2775 },
  },
  conduitFill: {
    note: 'Southwire 實測：2 in EMT 內徑 52.5018 mm、THHN 4/0 外徑 15.8496 mm × 3 條 → 27.34%。',
    values: { diameter: 52.5018, source: '範例：Southwire Re³ 計算器（NEC、2 in EMT、THHN 4/0）', cableDiameter: [15.8496], cableCount: [3] },
    expect: { fill: 27.34069 },
  },
  slope: {
    note: 'Construction Master Pro 例：高差 2 ft（0.6096 m）、坡度 65% → 水平距離約 3.077 ft（0.938 m）。',
    values: { mode: 'rise-grade', rise: 0.6096, grade: 65 },
    expect: { run: 0.9378462, diagonal: 1.1185560 },
  },
  roof: {
    note: 'Construction Master Pro 例：10/12 坡、平面 14 × 11 ft、4 × 8 ft 板 → 約 200.46 ft²、6.26 張等值。',
    values: { span: 4.2672, grade: 83.333333333, ridgeLength: 3.3528, boardLength: 2.4384, boardWidth: 1.2192 },
    expect: { area: 18.62363, boardEquivalent: 6.26447 },
  },
  cutFill: {
    note: '示範格網：10 × 10 m 間距、3 × 3 點；兩格有挖有填須細分，其餘挖方合計 77.5 m³。',
    values: { spacingX: 10, spacingY: 10, existing: '102 102.4 101.2\n102 101.8 101.3\n101.6 101.5 101.5', design: '101.5 101.5 101.5\n101.5 101.5 101.5\n101.5 101.5 101.5' },
    expect: { cut: 77.5, fill: 0, mixedCount: 2 },
  },
  stair: {
    note: 'Construction Master Pro 例：樓高 121 in（3,073.4 mm）→ 17 級時級高約 7.118 in（180.79 mm）。',
    values: { height: 3073.4, run: 4699, maxRise: 190.5 },
    expect: { risers: 17, treads: 16, actualRise: 180.78824, treadDepth: 293.6875 },
  },
  cylinder: {
    note: 'Construction Master Pro 例：直徑 28 in、高 54 in → 約 19.242 ft³（0.5449 m³）。',
    values: { diameter: 0.7112, height: 1.3716 },
    expect: { area: 0.3972587, circumference: 2.2343007, volume: 0.5448800 },
  },
  asphalt: {
    note: '規格例：100 m²、壓實厚 50 mm、密度 2,400 kg/m³（示範輸入）→ 5 m³、12 t。',
    values: { length: 10, width: 10, thickness: 50, density: 2400 },
    expect: { volume: 5, tonnes: 12 },
  },
  outrigger: {
    note: 'Liebherr 案例：最大支腿荷重 113 t（換算 1,108.15 kN）、鋼板 9 m² → 約 123.13 kPa。',
    values: { force: 1108.15145, area: 9, source: '範例：Liebherr LTM 1230-5.1 法蘭克福電梯井案例' },
    expect: { pressure: 123.12794, force: 1108.15145, area: 9 },
  },
  mortar: {
    note: 'QUIKRETE Mason Mix Type S 袋標（3/8 in 縫）：80 lb 袋 1,500 塊磚用 41 袋 → 自行反推每袋約 36.585 塊（非袋標原文）；100 塊磚 → 3 袋。',
    values: { units: 100, unitsPerBag: 36.585, source: '範例：QUIKRETE Mason Mix Type S 80 lb 袋標，磚、3/8 in 縫，1500 塊 ÷ 41 袋' },
    expect: { rawBags: 2.7333607, bags: 3 },
  },
  membrane: {
    note: 'Schluter 淋浴估算器實測：8 × 8 ft 牆（5.946 m²）、選膜材搭接加 5%、KERDI 膜卷標示 75 ft²（6.968 m²）→ 1 卷；接縫帶不在本工具。',
    values: { area: 5.94579456, product: '範例：Schluter KERDI 200/7M（1 × 7 m 卷）', source: '範例：Schluter 淋浴估算器結果頁，卷材標示 75 ft²', coverage: 6.967728, allowance: 5 },
    expect: { areaWithAllowance: 6.24308429, rawRolls: 0.896, rolls: 1 },
  },
  trimProfile: {
    note: 'Schluter 實測：JOLLY 10 mm 鋁收邊，單段 12 ft（3.6576 m）、每支 2.5 m → 2 支；外角 1 個為人工選入。',
    values: { length: 3.6576, stickLength: 2.5, outsideCorners: 1, source: '範例：Schluter Profile Estimator，J100AE 2.5 m／支、EV/J100AE 外角' },
    expect: { rawSticks: 1.46304, sticks: 2, outsideCorners: 1 },
  },
  ceilingGrid: {
    note: 'USG 天花規劃手冊房間例：12.5 × 18.5 ft（3.81 × 5.6388 m），中心線為格柵線 → 12 × 18 整格、兩端邊條各 3 in（76.2 mm）。原文為 12 × 12 in（304.8 mm）舌榫天花板，只驗證置中與邊條算法。',
    values: { length: 3.81, width: 5.6388, moduleLength: 304.8, moduleWidth: 304.8, mode: 'center-joint' },
    expect: { fullAlongLength: 12, borderLength: 76.2, fullAlongWidth: 18, borderWidth: 76.2 },
  },
  formworkPressure: {
    note: 'ACI 英制已發表算例換算（StrataWay 練習題）：牆高 10 ft（3.048 m）、150 pcf（取 2400 kg/m³）、4 ft/h（1.2192 m/h）、75°F（23.9°C）、I 型水泥無緩凝劑 → 630 psf ＝ 30.16 kN/m²，採公式 (b)。',
    values: { mode: 'aci', height: 3.048, member: 'wall', consolidation: 'standard', chemistry: '1.0', density: 2400, rate: 1.2192, temperature: 23.8888889 },
    expect: { pressure: 30.157484, cw: 1, cc: 1 },
  },
  rebarDevelopment: {
    note: '規範解說例：fc′ 280、fy 4200、D22 以上、常重、未塗布、底層筋；以 D22（22.2 mm）且（cb＋Ktr）÷ db ＝ 2.5 → ℓd 約 28.7 db（解說寫 28db）＝ 63.7 cm。cb 5.55 cm 為示範值。',
    values: { barSize: 'D22', member: 'general', fc: 280, fy: '4200', lambda: 'normal', topBar: 'no', coating: 'none', cover: 5.55, ktr: 0, confined: 'no', hookRestraint: 'no', hookPosition: 'no', oldCover: 'no', oldTies: 'no' },
    expect: { tensionInDiameters: 28.685487, tension: 63.68178, lapB: 82.786314, compression: 41.791168 },
  },
  staking: {
    note: '示範值：設計高程 12.500 m、地面實測 12.735 m → 高於設計 235 mm，要挖 235 mm。正負慣例（實測高於設計為挖）為使用者 2026-09-27 決定。',
    values: { design: 12.5, measured: 12.735 },
    expect: { difference: 235, cut: 235 },
  },
  coverage: {
    note: 'USG DUROCK Multi-Use 自流平估算器實測：28 ft²（2.601 m²）、3/8 in，技術表每袋 14 ft²（1.301 m²）→ 2 袋，與估算器相同。',
    values: { area: 2.60128512, perBag: 1.30064256, source: '範例：USG DUROCK Multi-Use 技術表 CB516，3/8 in 約 14 ft²/袋' },
    expect: { netArea: 2.60128512, rawBags: 2, bags: 2 },
  },
  pedestals: {
    note: 'Schluter TROBA-LEVEL 估算器實測：120 × 120 in（3.048 × 3.048 m）、23.62 in（599.948 mm）方形鋪石 → 49 支撐點。每包 10 支為示範值，非原廠包裝 → 5 包。',
    values: { length: 3.048, width: 3.048, paverLength: 599.948, paverWidth: 599.948, perPack: 10, source: '範例：每包 10 支為示範值' },
    expect: { alongLength: 6, alongWidth: 6, lastLength: 48.26, points: 49, perPack: 10, packs: 5 },
  },
  sidewallPressure: {
    note: 'Southwire 手冊 7-27 頁第 5–6 段彎頭：出口張力 5,119 lb（22.770 kN）、內側半徑 2.91 ft（0.887 m，手冊案例原文 inside radius）、w＝1.25 → 約 1,026 lb/ft（14.975 kN/m）。',
    values: { mode: 'cradled', tension: 22.7704464, radius: 0.886968, weightFactor: 1.25, source: '範例：Southwire Power Cable Manual 7-24–7-27 頁案例（2 in EMT、三條 4/0 THHN cradled）' },
    expect: { pressure: 14.975467 },
  },
  benderOffset: {
    note: 'Greenlee 884/885 手冊第 9 頁例：抬高 6 in（152.4 mm）、30° → 標記間距 12 in（304.8 mm）、shrink 1.5 in（38.1 mm）；障礙距起點 40 in（1,016 mm）為示範值。第 8 頁表：30°、6 in 抬高欄可用最大 1 in 管。',
    values: { offset: 152.4, angle: '30', obstacle: 1016 },
    expect: { spacing: 304.8, shrink: 38.1, secondMark: 1054.1, firstMark: 749.3, maxConduitColumn: 6 },
  },
  voltageDrop: {
    note: 'Southwire 電纜安裝手冊三相例：440 V、250 A、pf 0.8、750 ft（228.6 m），R 0.063、X 0.037 mΩ/ft（換成 Ω/km）→ VN 13.6125 V（手冊 13.6）、線間 23.58 V、5.66%；手冊印 23.5 V、5.64%，差異原因未查明。標稱電壓 440 V 為示範新欄位而設，非原例給定；電壓降占標稱電壓約 5.36%。上限 5% 為示範值，非規範值 → 占上限約 107.17%。',
    values: { system: 'three', voltage: 440, nominalVoltage: 440, dropLimit: 5, current: 250, length: 228.6, resistance: 0.2066929133858268, reactance: 0.12139107611548557, powerFactor: 0.8, source: '範例：Southwire Power Cable Installation Guide p.6-13（75°C）' },
    expect: { neutralDrop: 13.6125, drop: 23.5775416, loadVoltage: 416.4224584, regulation: 5.6619284, dropOfNominal: 5.35853, dropLimit: 5, limitUsage: 107.1706 },
  },
  pipePressureLoss: {
    note: 'Uponor PEX 手冊例：1 in AquaPEX 內徑 0.862 in（21.8948 mm）、60°F 水、12.73 gpm（0.8031 L/s）、100 ft（30.48 m）；f 0.02186 由手冊 Manadilli 式算得 → 7.00 ft/s、約 10.03 psi/100 ft（手冊 10.028）。',
    values: { mode: 'manual', diameter: 21.8948, flow: 0.803138200172, length: 30.48, frictionFactor: 0.02186, density: 998.91, source: '範例：Uponor PEX Piping Systems Design and Installation Manual 表 1-2、表 5-8、附錄 A' },
    expect: { velocity: 2.1331355, headLoss: 7.0600917, pressureLoss: 69.160381 },
  },
};
