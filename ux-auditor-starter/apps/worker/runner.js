
const { chromium } = require('playwright');
const axios = require('axios');
async function runAudit(url){
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const logs=[];
  page.on('console',msg=>logs.push(msg.text()));
  await page.goto(url);
  const buffer = await page.screenshot({fullPage:true});
  const screenshot = buffer.toString('base64');
  const buttons = await page.$$('button');
  const actions=[];
  for (let b of buttons){
    try{ await b.click(); actions.push({status:'success'});}catch{actions.push({status:'fail'});} }
  await browser.close();
  const res = await axios.post(process.env.N8N_WEBHOOK, {screenshot,logs,actions});
  return res.data;
}
module.exports={runAudit};
