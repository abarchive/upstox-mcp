require("dotenv").config();
const axios = require("axios");

async function getOptionChain() {

  try {

    const response = await axios.get(
      "https://api.upstox.com/v2/option/chain",
      {
        headers: {
          Authorization: `Bearer ${process.env.UPSTOX_ACCESS_TOKEN}`
        },
        params: {
          instrument_key: "NSE_INDEX|Nifty 50",
          expiry_date: "2026-06-25"
        }
      }
    );

    console.log(JSON.stringify(response.data, null, 2));

  } catch (err) {

    console.log("ERROR:");
    console.log(err.response?.data || err.message);

  }
}

getOptionChain();