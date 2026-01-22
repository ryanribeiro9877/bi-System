import fs from 'fs';
import readline from 'readline';

const filePath = 'C:/Users/Infosol/OneDrive - SENAC BA/Área de Trabalho/DadosCLT - Copia/DadosCLT - Drive/uy3_cbo_elegiveis_70%.xlsx.csv';

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (next === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ';' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseJsonField(field) {
  if (!field) return null;
  let s = field.trim();
  if (!s || s === 'null') return null;
  try {
    return JSON.parse(s);
  } catch (e1) {
    // Try unwrapping quotes and double quotes pattern from Excel/CSV
    if (s.startsWith('"') && s.endsWith('"')) {
      s = s.slice(1, -1).replace(/""/g, '"');
      try {
        return JSON.parse(s);
      } catch (e2) {
        return null;
      }
    }
    return null;
  }
}

function classifyAuth(raw) {
  if (!raw || !raw.trim()) return 'RA_VAZIO';
  const s = raw;
  if (s.includes('existing_authorization') || s.includes('EXISTING_AUTH') || s.includes('Autorização já existente')) {
    return 'RA_EXISTING_AUTH';
  }
  if (/status 400/.test(s)) return 'RA_ERRO_400';
  if (/status 429/.test(s)) return 'RA_ERRO_429';
  if (/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/.test(s)) {
    return 'RA_TOKEN';
  }
  return 'RA_OUTROS';
}

function extractErrorReason(raw) {
  if (!raw) return 'DESCONHECIDO';
  let m = raw.match(/Code:\s*([A-Z0-9_]+)/);
  if (m) return m[1];
  m = raw.match(/\\"code\\"\s*:\s*\\"([A-Z0-9_]+)\\"/);
  if (m) return m[1];
  m = raw.match(/status\s+\d+:\s*([^|\"]+)/i);
  if (m) return m[1].trim();
  return 'DESCONHECIDO';
}

function classifyMargin(raw, parsed) {
  if (!raw || !raw.trim()) return 'MARGEM_VAZIO';
  const s = raw;
  if (/status 400/.test(s)) return 'MARGEM_ERRO_400';
  if (/status 429/.test(s)) return 'MARGEM_ERRO_429';

  if (parsed) {
    if (Array.isArray(parsed)) {
      const first = parsed[0];
      if (first && first.status === 'OK') return 'MARGEM_OK';
    } else if (typeof parsed === 'object') {
      if (parsed.error) return 'MARGEM_ERRO_OUTRO';
      if (parsed.status === 'OK') return 'MARGEM_OK';
    }
  }

  return 'MARGEM_OUTRO';
}

function classifyProposal(raw, parsed) {
  if (!raw || !raw.trim()) return 'PROPOSTA_VAZIO';
  const s = raw;
  if (/status 400/.test(s)) return 'PROPOSTA_ERRO_400';
  if (/status 429/.test(s)) return 'PROPOSTA_ERRO_429';

  if (parsed) {
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const st = typeof item.status === 'string' ? item.status.toLowerCase().trim() : '';
      if (st === 'success') return 'PROPOSTA_SUCCESS';
      if (st) return 'PROPOSTA_OUTRO';
    }
  }

  if (/\"status\"\s*:\s*\"success\"/i.test(s)) return 'PROPOSTA_SUCCESS';
  return 'PROPOSTA_OUTRO';
}

function classifyBusiness(mCat, parsedMargem, pCat) {
  if (pCat === 'PROPOSTA_SUCCESS') return 'NEG_APROVADO';

  if (mCat === 'MARGEM_OK' && parsedMargem) {
    const ds = Array.isArray(parsedMargem) ? parsedMargem[0] : parsedMargem;
    const r0 = ds?.result && Array.isArray(ds.result) ? ds.result[0] : null;
    if (!r0) return 'NEG_MARGEM_OK_SEM_RESULT';

    if (r0.elegivel === false) return 'NEG_INELEGIVEL';
    const v = typeof r0.valorMargemDisponivel === 'number' ? r0.valorMargemDisponivel : Number(r0.valorMargemDisponivel);
    if (!Number.isNaN(v) && v <= 0) return 'NEG_SEM_MARGEM';
    if (r0.elegivel === true) return 'NEG_ELEGIVEL';

    return 'NEG_MARGEM_OK_OUTRO';
  }

  if (mCat === 'MARGEM_VAZIO') return 'NEG_SEM_CONSULTA_MARGEM';
  if (mCat === 'MARGEM_ERRO_400' || mCat === 'MARGEM_ERRO_429' || mCat === 'MARGEM_ERRO_OUTRO') return 'NEG_ERRO_CONSULTA_MARGEM';

  return 'NEG_NAO_AVALIADO';
}

const stats = {
  total_linhas: 0,
  cpfs_unicos: 0,
  auth_categorias: {
    RA_EXISTING_AUTH: 0,
    RA_TOKEN: 0,
    RA_ERRO_400: 0,
    RA_ERRO_429: 0,
    RA_OUTROS: 0,
    RA_VAZIO: 0
  },
  auth_erro_400_motivos: {},
  auth_erro_429_motivos: {},
  margem_categorias: {
    MARGEM_OK: 0,
    MARGEM_ERRO_400: 0,
    MARGEM_ERRO_429: 0,
    MARGEM_ERRO_OUTRO: 0,
    MARGEM_OUTRO: 0,
    MARGEM_VAZIO: 0
  },
  margem_somas: {
    soma_valorMargemDisponivel_positiva: 0,
    soma_valorMargemDisponivelOriginal_positiva: 0,
    qtd_valorMargemDisponivel_positiva: 0,
    qtd_valorMargemDisponivelOriginal_positiva: 0,
    qtd_valorMargemDisponivel_negativa: 0,
    qtd_valorMargemDisponivelOriginal_negativa: 0
  },
  proposta_categorias: {
    PROPOSTA_SUCCESS: 0,
    PROPOSTA_ERRO_400: 0,
    PROPOSTA_ERRO_429: 0,
    PROPOSTA_OUTRO: 0,
    PROPOSTA_VAZIO: 0,
    PROPOSTA_PARSE_FAIL: 0
  },
  margem_ok_detalhes: {
    elegivel_true: 0,
    elegivel_false: 0,
    elegivel_missing: 0,
    tipoBloqueio: {},
    motivoInelegibilidade: {}
  },
  negocio_categorias: {},
  cruzamento: {}
};

const cpfSet = new Set();

function inc(obj, key) {
  obj[key] = (obj[key] || 0) + 1;
}

function incCross(raCat, mCat) {
  if (!stats.cruzamento[raCat]) stats.cruzamento[raCat] = {};
  stats.cruzamento[raCat][mCat] = (stats.cruzamento[raCat][mCat] || 0) + 1;
}

function topN(obj, n) {
  return Object.fromEntries(Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n));
}

const rl = readline.createInterface({
  input: fs.createReadStream(filePath, { encoding: 'utf8' }),
  crlfDelay: Infinity
});

let isFirst = true;

rl.on('line', (line) => {
  if (isFirst) {
    isFirst = false; // skip header
    return;
  }
  if (!line.trim()) return;

  const cols = parseCsvLine(line);
  if (cols.length < 4) return;

  const cpf = cols[0].trim();
  const retornoAut = cols[2];
  const retornoMargem = cols[3];
  const retornoProposta = cols[5];

  stats.total_linhas++;
  if (cpf) cpfSet.add(cpf);

  // Classificar Retorno Autorizacao
  const raCat = classifyAuth(retornoAut);
  inc(stats.auth_categorias, raCat);

  if (raCat === 'RA_ERRO_400') {
    const motivo = extractErrorReason(retornoAut);
    inc(stats.auth_erro_400_motivos, motivo);
  } else if (raCat === 'RA_ERRO_429') {
    const motivo = extractErrorReason(retornoAut);
    inc(stats.auth_erro_429_motivos, motivo);
  }

  // Processar Retorno Margem
  const parsedMargem = parseJsonField(retornoMargem);
  const mCat = classifyMargin(retornoMargem, parsedMargem);
  inc(stats.margem_categorias, mCat);

  // Processar Retorno Proposta
  const parsedProposta = parseJsonField(retornoProposta);
  let pCat = 'PROPOSTA_VAZIO';
  if (retornoProposta && retornoProposta.trim() && !parsedProposta) {
    pCat = 'PROPOSTA_PARSE_FAIL';
  } else {
    pCat = classifyProposal(retornoProposta, parsedProposta);
  }
  inc(stats.proposta_categorias, pCat);

  // Detalhes da margem OK (primeiro result)
  if (mCat === 'MARGEM_OK' && parsedMargem) {
    const ds = Array.isArray(parsedMargem) ? parsedMargem[0] : parsedMargem;
    const r0 = ds?.result && Array.isArray(ds.result) ? ds.result[0] : null;
    if (r0) {
      if (r0.elegivel === true) stats.margem_ok_detalhes.elegivel_true++;
      else if (r0.elegivel === false) stats.margem_ok_detalhes.elegivel_false++;
      else stats.margem_ok_detalhes.elegivel_missing++;

      const tb = r0.tipoBloqueio === undefined || r0.tipoBloqueio === null || r0.tipoBloqueio === '' ? '<vazio>' : String(r0.tipoBloqueio);
      inc(stats.margem_ok_detalhes.tipoBloqueio, tb);

      const mi = r0.motivoInelegibilidade;
      if (mi !== undefined && mi !== null && String(mi).trim()) {
        inc(stats.margem_ok_detalhes.motivoInelegibilidade, String(mi).trim());
      }
    }
  }

  // Resultado de negócio (derivado)
  const negCat = classifyBusiness(mCat, parsedMargem, pCat);
  inc(stats.negocio_categorias, negCat);

  // Somar margens positivas/negativas quando houver estrutura de resultado
  if (parsedMargem) {
    const datasets = Array.isArray(parsedMargem) ? parsedMargem : [parsedMargem];
    for (const ds of datasets) {
      if (!ds || !Array.isArray(ds.result)) continue;
      for (const r of ds.result) {
        if (!r) continue;
        const vDisp = typeof r.valorMargemDisponivel === 'number' ? r.valorMargemDisponivel : Number(r.valorMargemDisponivel);
        const vDispOrig = typeof r.valorMargemDisponivelOriginal === 'number' ? r.valorMargemDisponivelOriginal : Number(r.valorMargemDisponivelOriginal);

        if (!Number.isNaN(vDisp)) {
          if (vDisp > 0) {
            stats.margem_somas.soma_valorMargemDisponivel_positiva += vDisp;
            stats.margem_somas.qtd_valorMargemDisponivel_positiva++;
          } else if (vDisp < 0) {
            stats.margem_somas.qtd_valorMargemDisponivel_negativa++;
          }
        }

        if (!Number.isNaN(vDispOrig)) {
          if (vDispOrig > 0) {
            stats.margem_somas.soma_valorMargemDisponivelOriginal_positiva += vDispOrig;
            stats.margem_somas.qtd_valorMargemDisponivelOriginal_positiva++;
          } else if (vDispOrig < 0) {
            stats.margem_somas.qtd_valorMargemDisponivelOriginal_negativa++;
          }
        }
      }
    }
  }

  // Cruzamento RA x Margem
  incCross(raCat, mCat);
});

rl.on('close', () => {
  stats.cpfs_unicos = cpfSet.size;
  stats.margem_ok_detalhes.tipoBloqueio = topN(stats.margem_ok_detalhes.tipoBloqueio, 20);
  stats.margem_ok_detalhes.motivoInelegibilidade = topN(stats.margem_ok_detalhes.motivoInelegibilidade, 20);
  console.log(JSON.stringify(stats, null, 2));
});
