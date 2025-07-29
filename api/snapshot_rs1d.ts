const fetch = require('node-fetch');


const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; RS-Bot/1.0; +https://relative-strength.vercel.app)'
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Prix figés au 23 février 2024 et 22 février 2024
const DATE_T = '23-02-2024';
const DATE_T_MINUS_1 = '22-02-2024';

async function fetchHistoricalPrice(id, date) {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${id}/history?date=${date}`;
    const res = await fetch(url, { headers: HEADERS });
    const json = await res.json();
    const val = json?.market_data?.current_price?.usd ?? null;
    return { val, raw: json };
  } catch (e) {
    return { val: null, error: e.message };
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.json({ error: 'Method Not Allowed' });
  }

  try {
    const { id, benchmark } = req.body;

    if (!id || !benchmark) {
      return res.status(400).json({ error: 'Missing token ID or benchmark' });
    }

    // Prix benchmark (Pb et Pb-1)
    const pb1Obj = await fetchHistoricalPrice(benchmark, DATE_T_MINUS_1);
    await delay(25000);
    const pbObj = await fetchHistoricalPrice(benchmark, DATE_T);
    await delay(25000);

    // Prix token (Pt et Pt-1)
    const pt1Obj = await fetchHistoricalPrice(id, DATE_T_MINUS_1);
    await delay(25000);
    const ptObj = await fetchHistoricalPrice(id, DATE_T);

    const pt = ptObj.val;
    const pt1 = pt1Obj.val;
    const pb = pbObj.val;
    const pb1 = pb1Obj.val;

    if (!pt || !pt1 || !pb || !pb1 || pt <= 0 || pt1 <= 0 || pb <= 0 || pb1 <= 0) {
      return res.status(422).json({
        error: 'Invalid price data',
        id,
        benchmark,
        pt, pt_minus1: pt1,
        pb, pb_minus1: pb1,
        pt_raw: ptObj.raw,
        pt1_raw: pt1Obj.raw,
        pb_raw: pbObj.raw,
        pb1_raw: pb1Obj.raw
      });
    }

    const rs1d = Math.log(pt / pt1) - Math.log(pb / pb1);

    return res.status(200).json({
      id,
      benchmark,
      pt,
      pt_minus1: pt1,
      pb,
      pb_minus1: pb1,
      rs_1d: rs1d
    });

  } catch (err) {
    return res.status(500).json({
      error: 'Internal Server Error',
      details: err.message,
      id: req.body?.id ?? null
    });
  }
};
