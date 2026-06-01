require("dotenv").config();
const axios = require("axios");

async function getQuote() {

  try {

    const response = await axios.get(
      "https://api.upstox.com/v2/market-quote/quotes",
      {
        headers: {
          Authorization: `Bearer ${process.env.UPSTOX_ACCESS_TOKEN}`
        },
        params: {
          instrument_key: "NSE_INDEX|Nifty 50"
        }
      }
    );

    console.log(JSON.stringify(response.data, null, 2));

  } catch (err) {

    console.log("ERROR:");
    console.log(err.response?.data || err.message);

  }
}

getQuote();