const mm = value => value / 1000;
const circle = diameter => Math.PI * (diameter / 2) ** 2;
// Float products like 8.9304 / 2.9768 give 3.0000000000000004; drop that noise before rounding up.
const ceil = value => Math.ceil(value * (1 - 1e-12));

// One row per line; values separated by spaces, commas or tabs. Blank lines are ignored.
// A comma or tab marks one cell, so an empty cell ("1,,2", a pasted blank) is rejected instead of
// silently shifting later values; separators at the row ends (a trailing CSV comma) are dropped.
const parseGrid = text => {
  const rows = text.trim().split(/\r?\n/).filter(line => line.trim())
    .map(line => line.replace(/^[\s,]+|[\s,]+$/g, '').split(/ *[,\t] *| +/)
      .map(token => token === '' ? NaN : Number(token)));
  if (rows.length < 2 || rows[0].length < 2) throw new RangeError('Grid needs at least 2 rows and 2 columns');
  for (const row of rows) {
    if (row.length !== rows[0].length) throw new RangeError('All grid rows must have the same number of values');
    if (!row.every(Number.isFinite)) throw new RangeError('Grid values must be numbers');
  }
  return rows;
};

// Tile set-out (#14), all sizes in mm.
const EPS = 1e-6;
const MAX_PIECES = 100000; // tileLayout and ceilingGrid: larger grids are refused, not computed

// Lay pieces into `space` that begins right after a piece (so each piece needs a joint first).
// Full tiles first, then one cut piece. A leftover too narrow for joint + piece (0 < gap <= joint)
// is returned as an unfilled `gap`, never as a zero or negative piece.
const tileRun = (space, tile, joint) => {
  const count = Math.floor(space / (tile + joint));
  const rest = space - count * (tile + joint);
  const pieces = Array(count).fill(tile);
  if (rest <= EPS) return { pieces, gap: 0 };
  if (rest <= joint + EPS) return { pieces, gap: rest };
  return { pieces: [...pieces, rest - joint], gap: 0 };
};

// One axis: ordered piece sizes from start edge to end edge plus unfilled gaps at [start, end].
const tileAxis = (length, tile, joint, mode) => {
  if (mode === 'edge') {
    const run = tileRun(length + joint, tile, joint); // a bare edge acts like a piece plus a joint
    return { pieces: run.pieces, gaps: [0, run.gap] };
  }
  if (mode === 'center-tile' && length <= tile + EPS) return { pieces: [length], gaps: [0, 0] };
  const run = mode === 'center-tile' ? tileRun((length - tile) / 2, tile, joint) : tileRun((length + joint) / 2, tile, joint);
  if (!run.pieces.length && mode === 'center-joint') throw new RangeError('Face is not wider than the joint');
  const centre = mode === 'center-tile' ? [tile] : [];
  return { pieces: [...[...run.pieces].reverse(), ...centre, ...run.pieces], gaps: [run.gap, run.gap] };
};

// CNS 560 (A2006) nominal diameters (mm), as printed in the Tung Ho Steel rebar catalog.
const CNS560_DIAMETER = { D10: 9.53, D13: 12.7, D16: 15.9, D19: 19.1, D22: 22.2, D25: 25.4, D29: 28.7, D32: 32.2, D36: 35.8, D39: 39.4, D43: 43.0, D57: 57.3 };

// Greenlee 884/885 manual p. 9 "Offset Multiplier and Shrink Table", as printed:
// angle -> [center-to-center multiplier, shrink per unit of offset depth]. Both are ratios, so mm in -> mm out.
const GREENLEE_884_OFFSET = { 10: [6.0, 1 / 16], 15: [3.86, 1 / 8], 22.5: [2.6, 3 / 16], 30: [2.0, 1 / 4], 45: [1.4, 3 / 8], 60: [1.2, 1 / 2] };
// Greenlee 884/885 manual p. 8 Offset Table: maximum conduit trade size (in) per offset column 2, 4, ... 22 in.
// Only 15°, 30° and 45° are listed; null = blank cell (offset too small for that angle).
const GREENLEE_884_MAX_CONDUIT = {
  15: ['3/4', '1-1/2', '3-1/2', '4', '4', '4', '4', '4', '4', '4', '4'],
  30: [null, '3/4', '1', '1-1/2', '2', '2-1/2', '3-1/2', '4', '4', '4', '4'],
  45: [null, null, '1/2', '1', '1-1/4', '1-1/2', '2', '2-1/2', '3', '3-1/2', '4'],
};
// Largest table column not above the offset: the listed size never shrinks as the offset grows, so the
// lower column is the conservative reading between columns.
const maxConduit = (offsetMm, angle) => {
  const row = GREENLEE_884_MAX_CONDUIT[angle];
  if (!row) return {};
  const index = Math.min(Math.floor(offsetMm / 25.4 / 2 + 1e-9) - 1, row.length - 1);
  return index < 0 || !row[index] ? {} : { maxConduit: row[index], maxConduitColumn: 2 * (index + 1) };
};

globalThis.toolboxCalculate = {
  slab: ({ length, width, thickness, yieldPerBag }) => {
    const volume = length * width * mm(thickness);
    const rawBags = volume / yieldPerBag;
    return { volume, rawBags, bags: ceil(rawBags) };
  },
  hole: ({ diameter, depth, count, yieldPerBag }) => {
    const perHole = circle(diameter) * depth;
    const volume = perHole * count;
    return { perHole, volume, ...(yieldPerBag == null ? {} : { rawBags: volume / yieldPerBag, bags: ceil(volume / yieldPerBag) }) };
  },
  sealant: ({ length, width, depth, capacity, loss }) => {
    const net = length * width * depth;
    const effective = capacity * (1 - loss / 100);
    const rawCartridges = net / effective;
    return { net, effective, rawCartridges, cartridges: ceil(rawCartridges) };
  },
  aggregate: ({ length, width, thickness, density }) => {
    const volume = length * width * mm(thickness);
    return { volume, ...(density == null ? {} : { mass: volume * density }) };
  },
  rebar: ({ unitWeight, length, count }) => {
    const totalLength = length * count;
    return { totalLength, mass: totalLength * unitWeight };
  },
  plate: ({ length, width, thickness, density, count }) => {
    const perPiece = length * width * mm(thickness) * density;
    return { perPiece, mass: perPiece * count };
  },
  tile: ({ length, width, tileLength, tileWidth, perBox }) => {
    const area = length * width;
    const tileArea = mm(tileLength) * mm(tileWidth);
    const rawTiles = area / tileArea;
    const tiles = ceil(rawTiles);
    const rawBoxes = tiles / perBox;
    return { area, tileArea, rawTiles, tiles, rawBoxes, boxes: ceil(rawBoxes) };
  },
  slope: ({ mode, rise, run, grade }) => {
    if (mode === 'rise-run') grade = rise / run * 100;
    if (mode === 'rise-grade') run = rise / (grade / 100);
    if (mode === 'run-grade') rise = run * grade / 100;
    return { rise, run, grade, diagonal: Math.hypot(rise, run) };
  },
  // Symmetric gable: span is the horizontal distance between the two eaves lines, grade in %.
  roof: ({ span, grade, ridgeLength, boardLength, boardWidth }) => {
    if ((boardLength == null) !== (boardWidth == null)) throw new RangeError('Board length and width go together');
    const halfSpan = span / 2;
    const rise = halfSpan * grade / 100;
    const rafter = Math.hypot(halfSpan, rise);
    const area = 2 * rafter * ridgeLength;
    return { halfSpan, rise, rafter, area, ...(boardLength == null ? {} : { boardEquivalent: area / (boardLength * boardWidth) }) };
  },
  // Known single-outrigger reaction (kN) over the confirmed effective mat area (m²); 1 kN/m² = 1 kPa.
  outrigger: ({ force, area, source }) => ({ force, area, pressure: force / area, source }),
  // Product rate is the confirmed kg/m² for the chosen trowel/bed; allowance is added on top.
  adhesive: ({ area, product, source, rate, bagWeight, allowance }) => {
    const mass = area * rate;
    const massWithAllowance = mass * (1 + allowance / 100);
    const rawBags = massWithAllowance / bagWeight;
    return { mass, massWithAllowance, rawBags, bags: ceil(rawBags), product, source };
  },
  // #10 maximum lateral pressure of fresh concrete on formwork (kN/m² = kPa), code chosen by the user.
  // ACI 347R-14 4.2.2.1b (SI) with Table 4.2.2.1b selection, Cw table 4.2.2.1a(c), Cc table 4.2.2.1a(b);
  // JASS 5 (2022) full liquid head W0·H; JSCE 2017 columns, slump about 10 cm or less, ≤ 150 kN/m².
  formworkPressure: ({ mode, height, rate, temperature, density, unitWeight, member, consolidation, chemistry }) => {
    if (mode === 'jass5') return { pressure: unitWeight * height, governs: '液壓 W0·H（JASS 5 2022）' };
    if (mode === 'jsce') {
      const formula = unitWeight / 3 * (1 + 100 * rate / (temperature + 20));
      // NOTE(ceiling): the Wc·H cap is inferred (pressure cannot exceed liquid head); the 2017 text was not read.
      const cap = Math.min(150, unitWeight * height);
      return formula <= cap
        ? { pressure: formula, governs: 'JSCE 柱公式' }
        : { pressure: cap, governs: cap === 150 ? 'JSCE 上限 150 kN/m²' : '液壓上限 Wc·H' };
    }
    const liquid = density * 9.81 * height / 1000;
    const cw = density < 2240 ? Math.max(0.5 * (1 + density / 2320), 0.8) : density <= 2400 ? 1 : density / 2320;
    const cc = Number(chemistry.slice(0, 3));
    let equation = null;
    if (consolidation === 'standard') {
      if (member === 'column') equation = 'b';
      else if (rate > 4.5) equation = null;
      else if (rate >= 2.1) equation = 'c';
      else equation = height <= 4.2 ? 'b' : 'c';
    }
    if (!equation) return { pressure: liquid, governs: '液壓 ρgh（此條件不適用公式）', cw, cc };
    const t = temperature + 17.8;
    const formula = cc * cw * (equation === 'b' ? 7.2 + 785 * rate / t : 7.2 + 1156 / t + 244 * rate / t);
    // Minimum 30Cw, but in no case greater than ρgh.
    const bounded = Math.max(formula, 30 * cw);
    if (bounded > liquid) return { pressure: liquid, governs: '液壓上限 ρgh', cw, cc };
    return { pressure: bounded, governs: formula < 30 * cw ? '下限 30Cw' : `公式 4.2.2.1b(${equation})`, cw, cc };
  },
  // #11 straight-bar development and lap lengths, Taiwan 建築物混凝土結構設計規範 (112) ch. 25, kgf units, cm out.
  // db in mm; fy is one of 4200/5000/5600/7000 (the only ψg values the code lists); fc', cb, Ktr in kgf/cm² and cm.
  // Hooks (25.4.3): new form ℓdh = fy ψe ψr ψo ψc / (23 λ √fc') · db^1.5 (db in cm), ≥ 8db, ≥ 15 cm; and the
  // retained older form 25.4.3.5–8, 0.075 fy ψe / √fc' · db (× 1.3 lightweight, × 0.7 cover, × 0.8 ties) where
  // 25.4.3.5 allows it by bar size and fc'. barSize is a CNS 560 designation ('D10' … 'D57'); db comes from the table.
  rebarDevelopment: ({ barSize, member, fc, fy: grade, lambda, topBar, coating, cover, ktr, spacing, confined, hookRestraint, hookPosition, oldCover, oldTies }) => {
    const fy = Number(grade); // select value
    const size = Number(barSize.slice(1));
    const diameter = CNS560_DIAMETER[barSize];
    if (!diameter) throw new RangeError('Unknown bar size');
    const db = diameter / 10;
    // 25.4.2.2: fy ≥ 5600 with bar spacing < 15 cm needs Ktr ≥ 0.5db; a blank spacing cannot be judged, so stop.
    // 10.7.1.3: column longitudinal bars at fy ≥ 5600 need Ktr ≥ 0.5db at any spacing.
    if (fy >= 5600 && (spacing == null || ((spacing < 15 || member === 'column') && (ktr ?? 0) < 0.5 * db))) {
      throw new RangeError('25.4.2.2 / 10.7.1.3 transverse reinforcement not satisfied or not checkable');
    }
    const root = Math.min(Math.sqrt(fc), 26.5); // 25.4.1.4
    const lam = lambda === 'light' ? 0.75 : 1;
    const psiTE = Math.min((topBar === 'yes' ? 1.3 : 1) * { none: 1, epoxyThin: 1.5, epoxy: 1.2 }[coating], 1.7);
    const psiS = size <= 19 ? 0.8 : 1;
    const upToD36 = size <= 36;
    const confinement = Math.min((cover + (ktr ?? 0)) / db, 2.5);
    const psiG = { 4200: 1, 5000: 1.08, 5600: 1.15, 7000: 1.3 }[fy];
    if (!psiG) throw new RangeError('fy must be 4200, 5000, 5600 or 7000 kgf/cm²');
    // 25.4.2.4a; laps use this value before the 30 cm minimum (25.5.2.1).
    const rawTension = fy / (3.5 * lam * root) * psiTE * psiS / confinement * db;
    const psiR = confined === 'yes' ? 0.75 : 1;
    const compression = Math.max(0.075 * fy * psiR / (lam * root) * db, 0.0044 * fy * psiR * db, 20);
    const lapFactor = fc < 210 ? 4 / 3 : 1;
    // 25.5.1.1: bars larger than D36 may not be lap spliced (the 25.5.5.3 compression exception needs the other bar).
    const compressionLap = !upToD36 ? undefined : fy <= 4200 ? Math.max(0.0073 * fy * db, 30) * lapFactor
      : fy <= 5600 ? Math.max((0.013 * fy - 24) * db, 30) * lapFactor : undefined;
    const hookEpoxy = coating === 'none' ? 1 : 1.2;
    const psiC = fc < 420 ? fc / 1050 + 0.6 : 1;
    const psiRh = upToD36 && hookRestraint === 'yes' ? 1 : 1.6;
    const psiO = upToD36 && hookPosition === 'yes' ? 1 : 1.25;
    const hook = Math.max(fy * hookEpoxy * psiRh * psiO * psiC / (23 * lam * root) * db ** 1.5, 8 * db, 15);
    const oldLimit = size <= 25 ? 700 : { 29: 490, 32: 420, 36: 350 }[size];
    const oldHook = oldLimit !== undefined && fc <= oldLimit
      ? Math.max(0.075 * fy * hookEpoxy / root * db * (lambda === 'light' ? 1.3 : 1)
        * (oldCover === 'yes' ? 0.7 : 1) * (oldTies === 'yes' ? 0.8 : 1), 8 * db, 15)
      : undefined;
    return {
      diameter, hook, ...(oldHook === undefined ? {} : { oldHook }),
      tension: Math.max(rawTension, 30),
      ...(upToD36 ? { lapA: Math.max(psiG * rawTension, 30), lapB: Math.max(1.3 * psiG * rawTension, 30) } : {}),
      compression, ...(compressionLap === undefined ? {} : { compressionLap }), confinement, psiG,
      tensionInDiameters: Math.max(rawTension, 30) / db,
    };
  },
  // #46 single stake point: difference = measured ground elevation - design elevation (m in, mm out).
  // Positive = cut (ground above design), negative = fill; measured must already be the ground point
  // elevation (instrument and target heights applied), so nothing is added or subtracted here.
  staking: ({ design, measured }) => {
    const difference = (measured - design) * 1000;
    if (Math.abs(difference) <= EPS) return { difference: 0, onGrade: 0 };
    return { difference, ...(difference > 0 ? { cut: difference } : { fill: -difference }) };
  },
  // #4/#5/#25/#26 merged: net area (m², openings optional) ÷ user-confirmed coverage per bag at the chosen thickness.
  coverage: ({ area, openings, perBag, source }) => {
    const netArea = area - (openings ?? 0);
    if (netArea <= 0) throw new RangeError('Openings must be smaller than the total area');
    const rawBags = netArea / perBag;
    return { netArea, rawBags, bags: ceil(rawBags), source };
  },
  // Cross-section fill of one round conduit; rows are cable outer diameter (mm) and count.
  conduitFill: ({ diameter, cableDiameter, cableCount, source }) => {
    if (cableDiameter.length !== cableCount.length || cableDiameter.some(d => d >= diameter)) {
      throw new RangeError('Each cable must be narrower than the conduit bore');
    }
    const conduitArea = circle(diameter);
    const rows = cableDiameter.map((d, i) => ({ d, n: cableCount[i], area: cableCount[i] * circle(d) }));
    const cableArea = rows.reduce((sum, row) => sum + row.area, 0);
    const fill = 100 * cableArea / conduitArea;
    return { rows, conduitArea, cableArea, fill, ...(fill > 100 ? { overfull: true } : {}), source };
  },
  // Units per bag is the confirmed bag-label rate for the chosen product, unit type and joint.
  mortar: ({ units, unitsPerBag, source }) => {
    const rawBags = units / unitsPerBag;
    return { rawBags, bags: ceil(rawBags), source };
  },
  // Sheet membrane rolls only: confirmed coverage per roll (m²/roll), allowance added on top of the area.
  membrane: ({ area, product, source, coverage, allowance }) => {
    const areaWithAllowance = area * (1 + allowance / 100);
    const rawRolls = areaWithAllowance / coverage;
    return { areaWithAllowance, rawRolls, rolls: ceil(rawRolls), product, source };
  },
  // One edge run, sticks = length / confirmed stick length; corner pieces are echoed as counted by hand.
  trimProfile: ({ length, stickLength, outsideCorners, insideCorners, source }) => {
    const rawSticks = length / stickLength;
    return {
      rawSticks, sticks: ceil(rawSticks), source,
      ...(outsideCorners == null ? {} : { outsideCorners }),
      ...(insideCorners == null ? {} : { insideCorners }),
    };
  },
  // Rectangular area (m), pavers (mm) on a regular grid, one support at every paver corner:
  // pieces per direction = ceil(side / paver), support lines = pieces + 1, points = product of lines.
  // lastLength/lastWidth: width of the final row when laying full pavers from one corner (mm).
  // perPack is optional and user-entered from the package label; one pack size for every pedestal height.
  pedestals: ({ length, width, paverLength, paverWidth, perPack, source }) => {
    const alongLength = ceil(length * 1000 / paverLength);
    const alongWidth = ceil(width * 1000 / paverWidth);
    const points = (alongLength + 1) * (alongWidth + 1);
    return {
      alongLength, alongWidth,
      lastLength: length * 1000 - (alongLength - 1) * paverLength,
      lastWidth: width * 1000 - (alongWidth - 1) * paverWidth,
      points, ...(perPack == null ? {} : { perPack, packs: ceil(points / perPack) }), source,
    };
  },
  // Southwire Power Cable Manual p. 7-16: single cable SP = T / R (eq. 7-20); three single-conductor
  // cables cradled SP = (3w - 2) × T / (3R) (eq. 7-21) or triangular SP = w × T / (2R) (eq. 7-22).
  // T = tension leaving the bend (kN), R = bend radius (m), w = weight correction factor (eq. 7-18
  // cradled / 7-17 triangular, both >= 1); result in kN/m. No allowable-limit comparison.
  sidewallPressure: ({ mode, tension, radius, weightFactor, source }) => {
    if (mode === 'single') return { pressure: tension / radius, source };
    if (weightFactor < 1) throw new RangeError('Weight correction factor is at least 1');
    if (mode === 'triangular') return { pressure: weightFactor * tension / (2 * radius), source };
    return { pressure: (3 * weightFactor - 2) * tension / (3 * radius), source };
  },
  // Offset (mm) and table angle (select value as string). Obstacle = pipe start to obstruction face (mm), optional;
  // manual rule: second mark = obstacle + shrink, first mark = second mark - center-to-center distance.
  // Multiplier is the exact 1 / sin(angle), matching the manual's p. 8 Offset Table (user decision 2026-09-27);
  // the printed quick multipliers (e.g. 1.4 at 45°) are rounded. Shrink stays as printed on p. 9.
  benderOffset: ({ offset, angle, obstacle }) => {
    const row = GREENLEE_884_OFFSET[angle];
    if (!row) throw new RangeError('Angle is not in the Greenlee 884/885 offset table');
    const shrinkRate = row[1];
    const multiplier = 1 / Math.sin(Number(angle) * Math.PI / 180);
    const spacing = offset * multiplier;
    const shrink = offset * shrinkRate;
    const table = maxConduit(offset, angle);
    if (obstacle == null) return { multiplier, shrinkRate, spacing, shrink, ...table };
    const secondMark = obstacle + shrink;
    // 1 / sin leaves float noise (1 / sin 30° = 2.0000000000000004); a mark within EPS of the start is at the start.
    const rawFirstMark = secondMark - spacing;
    if (rawFirstMark < -EPS) throw new RangeError('First mark would fall before the pipe start');
    const firstMark = Math.max(rawFirstMark, 0);
    return { multiplier, shrinkRate, spacing, shrink, secondMark, firstMark, ...table };
  },
  // Southwire Power Cable Installation Guide approximate AC drop, eq. 6-26 / 6-27 / 6-30 / 6-18.
  // R and X are per-conductor Ω/km at operating temperature; length is one-way in m; load assumed lagging.
  // nominalVoltage is optional and independent of Es; it only feeds the drop-of-nominal percentage.
  // dropLimit is an optional user-entered limit (% of En); the result is a plain ratio, never a pass/fail.
  voltageDrop: ({ system, current, length, resistance, reactance, powerFactor, voltage, nominalVoltage, dropLimit, source }) => {
    if (powerFactor > 1) throw new RangeError('Power factor cannot exceed 1');
    if (dropLimit != null && nominalVoltage == null) throw new RangeError('A drop limit needs the nominal voltage');
    const sin = Math.sqrt(1 - powerFactor ** 2);
    const perConductor = current * (resistance * powerFactor + reactance * sin) * length / 1000;
    const drop = system === 'three' ? Math.sqrt(3) * perConductor : 2 * perConductor;
    if (drop >= voltage) throw new RangeError('Drop must stay below the source voltage');
    const regulation = 100 * drop / (voltage - drop);
    return {
      drop, ...(system === 'three' ? { neutralDrop: perConductor } : {}), loadVoltage: voltage - drop, regulation,
      ...(nominalVoltage == null ? {} : { dropOfNominal: 100 * drop / nominalVoltage }),
      ...(dropLimit == null ? {} : { dropLimit, limitUsage: 100 * (100 * drop / nominalVoltage) / dropLimit }), source,
    };
  },
  // Darcy-Weisbach straight-pipe loss (Uponor PEX manual ch. 4): hf = f × (L / D) × V² / (2g).
  // f is the confirmed Darcy friction factor for this flow (not Fanning); density turns head into kPa.
  // Mode "computed": Darcy f from the same manual's explicit Manadilli equation, only inside the range
  // the spec allows (Re >= 5235, e/D <= 0.05); outside it the user must enter a confirmed f instead.
  pipePressureLoss: ({ mode, diameter, flow, length, frictionFactor, roughness, viscosity, density, source }) => {
    const bore = mm(diameter);
    const velocity = mm(flow) / circle(bore); // L/s -> m³/s
    let computed = {};
    if (mode === 'computed') {
      const reynolds = density * velocity * bore / (viscosity / 1000); // mPa·s -> Pa·s
      const relativeRoughness = roughness / diameter; // both mm
      if (reynolds < 5235 || relativeRoughness > 0.05) throw new RangeError('Outside the Manadilli range; enter a confirmed f');
      frictionFactor = (-2 * Math.log10(relativeRoughness / 3.7 + 95 / reynolds ** 0.983 - 96.82 / reynolds)) ** -2;
      computed = { reynolds, relativeRoughness };
    }
    const headLoss = frictionFactor * (length / bore) * velocity ** 2 / (2 * 9.80665);
    return {
      velocity, headLoss, pressureLoss: density * 9.80665 * headLoss / 1000, frictionFactor, ...computed,
      frictionMethod: mode === 'computed' ? 'Manadilli 顯式式代算（Uponor 手冊第 4 章）' : '使用者手填', source,
    };
  },
  stair: ({ height, run, maxRise }) => {
    const risers = ceil(height / maxRise);
    if (risers < 2) throw new RangeError('At least two risers are required');
    const treads = risers - 1;
    return { risers, treads, actualRise: height / risers, treadDepth: run / treads };
  },
  cylinder: ({ diameter, height }) => {
    const area = circle(diameter);
    return { area, circumference: Math.PI * diameter, volume: area * height };
  },
  asphalt: ({ length, width, thickness, density }) => {
    const volume = length * width * mm(thickness);
    return { volume, tonnes: volume * density / 1000 };
  },
  tileLayout: ({ width, height, tileWidth, tileHeight, joint, mode }) => {
    const x = tileAxis(width, tileWidth, joint, mode);
    const y = tileAxis(height, tileHeight, joint, mode);
    // A half-typed size (e.g. "6" on the way to "600") must not loop and draw hundreds of thousands of pieces.
    if (x.pieces.length * y.pieces.length > MAX_PIECES) throw new RangeError('Too many pieces to lay out');
    const groups = new Map();
    let fullTiles = 0;
    for (const h of y.pieces) {
      for (const w of x.pieces) {
        if (Math.abs(w - tileWidth) <= EPS && Math.abs(h - tileHeight) <= EPS) {
          fullTiles += 1;
          continue;
        }
        const key = `${w.toFixed(3)}x${h.toFixed(3)}`;
        const group = groups.get(key) ?? { w, h, count: 0 };
        group.count += 1;
        groups.set(key, group);
      }
    }
    const cutList = [...groups.values()].sort((a, b) => b.count - a.count || a.w - b.w || a.h - b.h);
    const totalPieces = x.pieces.length * y.pieces.length;
    return {
      moduleX: tileWidth + joint, moduleY: tileHeight + joint,
      xs: x.pieces, ys: y.pieces, xGaps: x.gaps, yGaps: y.gaps,
      fullTiles, cutPieces: totalPieces - fullTiles, totalPieces, cutList,
    };
  },
  // #24 suspended ceiling grid: tileLayout with a zero-width grid line, room in m, module in mm.
  // Border = cut piece at each end (symmetric in both centring modes); 0 when the room divides exactly.
  ceilingGrid: ({ length, width, moduleLength, moduleWidth, mode }) => {
    const layout = globalThis.toolboxCalculate.tileLayout({ width: length * 1000, height: width * 1000, tileWidth: moduleLength, tileHeight: moduleWidth, joint: 0, mode });
    // A room narrower than one module (centre-of-panel mode) is a single cut piece, not two borders.
    const axis = (pieces, module) => {
      const full = pieces.filter(piece => Math.abs(piece - module) <= EPS).length;
      if (pieces.length === 1 && full === 0) return { full, single: pieces[0] };
      return { full, border: full === pieces.length ? 0 : pieces[0] };
    };
    const along = axis(layout.xs, moduleLength);
    const across = axis(layout.ys, moduleWidth);
    return {
      fullAlongLength: along.full, fullAlongWidth: across.full,
      ...(along.single === undefined ? { borderLength: along.border } : { singleLength: along.single }),
      ...(across.single === undefined ? { borderWidth: across.border } : { singleWidth: across.single }),
      fullPanels: layout.fullTiles, cutPanels: layout.cutPieces,
    };
  },
  // Joint volume per m² in litres: (A + B) / (A × B) × depth × joint, all in mm (1 m² × 1 mm = 1 L).
  grout: ({ area, tileLength, tileWidth, depth, joint, density, allowance, bagWeight }) => {
    const litresPerSquareMetre = (tileLength + tileWidth) / (tileLength * tileWidth) * depth * joint;
    const volume = litresPerSquareMetre * area;
    const mass = volume * density;
    const massWithAllowance = mass * (1 + allowance / 100);
    const rawBags = massWithAllowance / bagWeight;
    return { litresPerSquareMetre, volume, mass, massWithAllowance, rawBags, bags: ceil(rawBags) };
  },
  gypsum: ({ area, boardLength, boardWidth, tapeRate, screwRate }) => {
    const boardArea = mm(boardLength) * mm(boardWidth);
    const rawBoards = area / boardArea;
    return {
      boardArea, rawBoards, boards: ceil(rawBoards),
      ...(tapeRate == null ? {} : { tape: area * tapeRate }),
      ...(screwRate == null ? {} : { rawScrews: area * screwRate, screws: ceil(area * screwRate) }),
    };
  },
  // Corner diff = existing - design. net = cut - fill (positive: surplus soil, negative: soil shortage).
  cutFill: ({ spacingX, spacingY, existing, design }) => {
    const ground = parseGrid(existing);
    const target = parseGrid(design);
    if (ground.length !== target.length || ground[0].length !== target[0].length) {
      throw new RangeError('Existing and design grids must have the same shape');
    }
    const area = spacingX * spacingY;
    const diff = (r, c) => ground[r][c] - target[r][c];
    const cells = [];
    for (let row = 0; row < ground.length - 1; row++) {
      for (let col = 0; col < ground[0].length - 1; col++) {
        const corners = [diff(row, col), diff(row, col + 1), diff(row + 1, col), diff(row + 1, col + 1)];
        const avgDiff = corners.reduce((sum, value) => sum + value, 0) / 4;
        const mixed = corners.some(value => value > 0) && corners.some(value => value < 0);
        const cut = !mixed && avgDiff > 0 ? avgDiff * area : 0;
        const fill = !mixed && avgDiff < 0 ? -avgDiff * area : 0;
        cells.push({ row, col, avgDiff, cut, fill, mixed });
      }
    }
    let maxCell = null;
    cells.forEach((cell, index) => {
      if (!cell.mixed && (maxCell == null || Math.abs(cell.avgDiff) > Math.abs(cells[maxCell].avgDiff))) maxCell = index;
    });
    const cut = cells.reduce((sum, cell) => sum + cell.cut, 0);
    const fill = cells.reduce((sum, cell) => sum + cell.fill, 0);
    return { cells, cut, fill, total: cut + fill, net: cut - fill, mixedCount: cells.filter(cell => cell.mixed).length, maxCell };
  },
};
