// st3alth · the manual: window 6. What st3alth does, what it hides and what stays public, the keys, every command, faq.
import { $, esc } from './core.js?v=6';
import { CMDS } from './cmds.js?v=6';

const CARDS = [
  ['trace', 'who can see you', 'paste any wallet. st3alth follows its first SOL back through up to three funders, labels every exchange and protocol on the way, maps who it talks to, and scores how close it is to a name.', 'trace'],
  ['burners', 'a wallet for one job', 'a fresh keypair born in this tab. trade from it, then sweep and forget it. the key never touches a server, and your main wallet never shows up in the trade.', 'burner new'],
  ['private reads', 'your ip stays home', 'every chain read goes through st3alth to helius. no public rpc ever sees your ip next to your wallet, and nothing in your browser talks to anyone else.', 'privacy'],
  ['trade', 'every dex, one line', 'swaps routed by jupiter across every solana dex, limit orders, dca, tokenized stocks. you see the exact route and fees before your wallet signs.', 'swap 0.1 sol usdc'],
  ['scan', 'every coin as it is born', 'pump.fun births, the final stretch and graduations, live, with the numbers trenchers check first: top holders, dev history, bots, bundles.', 'scan'],
  ['checkup', 'one page, every leak', 'exposure, threats, approvals, your browser fingerprint, this tab and your signer, audited together, graded, with the fixes in order.', 'checkup'],
  ['link', 'are these two wallets linked?', 'direct transfers, a shared funder, private wallets in common, the same hours. see what ties two wallets together before someone else does.', 'link'],
  ['follow', 'a live tail on any wallet', 'follow a wallet and every transfer in or out prints in your console as it lands, labelled: exchanges, protocols, known wallets. up to three at once.', 'follow'],
  ['threats', 'who is working against you', 'every trace looks for address poisoning (a look-alike of a wallet you pay, planted in your history with a tiny transfer) and for dust from strangers.', 'trace'],
  ['approvals', 'who can move your tokens', 'token approvals are standing permissions that drainers wait on. see every one on a wallet, and revoke them all with a single signature.', 'approvals'],
  ['fingerprint', 'what your browser gives away', 'the twelve signals any site can read without asking, hashed the way trackers do. it is worked out in your tab and sent nowhere.', 'fingerprint'],
  ['bundle', 'who is really holding it', 'any coin: its twenty biggest holders, the wallet that sent each one its first SOL, and the clusters that came from one hand. bundles stop hiding.', 'bundle'],
  ['file', 'the file on a wallet', 'names, funders, the exchange at the root, who it pays, what it holds, when it sleeps and where that puts it. what a stranger can pull together in a second.', 'file'],
  ['vanity', 'a burner with your letters', 'grind a keypair whose address starts or ends with letters you pick. every key is made in this tab by your own cpu, and none of them is sent anywhere.', 'vanity st3 -i'],
  ['sonar', 'every birth on one screen', 'the radar sweeps pump.fun: each new coin lands as a blip and drifts outward as it ages. hover one to see it, click it for the full report.', 'radar'],
  ['strip', 'what your photos give away', 'drop a photo anywhere: see its gps, phone, serial and time, then save a clean copy, checked by reading it back. it never leaves your tab.', 'strip'],
];
const KEYS = [['ctrl k', 'the palette: every command and window'], ['alt 0 … 8', 'switch window'], ['tab / →', 'take the suggestion'], ['↑ ↓', 'history'], ['ctrl l', 'clear the shell'], ['/', 'back to the prompt'], ['shift esc', 'panic: hide the screen'], ['esc', 'skip the intro, close the palette']];
const FAQ = [
  ['is st3alth a mixer?', 'no. st3alth never holds or pools anyone\'s funds. it shows you what is already public, gives you burners that live in your own tab, and keeps your browser from talking to anyone but itself.'],
  ['can trace see my private keys or my history if i trace myself?', 'no. trace reads only what is public on the chain, through helius, the same way anyone could. your keys never leave your wallet or your tab.'],
  ['how is the exposure score worked out?', 'it adds points for things a stranger can link to a wallet: an exchange in the first funding hops, a .sol name or public label, deposits to an exchange, two-way transfers with the same wallets, and a tight daily rhythm. every point is listed with its reason.'],
  ['what does powered by helius mean here?', 'st3alth reads the chain through helius: its rpc for every read, its wallet api for funders and labels, and its fee estimates. helius does not run st3alth and has not endorsed it.'],
  ['where do burners live?', 'in this tab only. close the tab and the key is gone, unless you saved its key file. st3alth\'s server never sees a key.'],
  ['what is address poisoning?', 'a scammer makes an address with the same first and last characters as one you pay, then sends you a tiny transfer from it so it sits in your history. if you copy the wrong one next time, the money is gone. trace flags these; the fix is to check every character, or keep a saved contact.'],
  ['do fingerprint and strip send anything anywhere?', 'no. both run entirely in your tab: the fingerprint is computed and shown, the photo is read and re-drawn locally. you can check it: nothing appears in the network tab.'],
  ['does anything here make me invisible?', 'no. a public chain is public. st3alth can show you your trail and help you leave a thinner one, nothing more. confidential is not anonymous.'],
  ['is this advice?', 'no. nothing here is financial or legal advice. most memecoins go to zero.'],
];
let done = false;
export function manual() {
  if (done) return; done = true;
  const groups = {}; Object.values(CMDS).filter(c => c.help).forEach(c => { (groups[c.cat] = groups[c.cat] || []).push(c); });
  const order = ['privacy', 'trade', 'wallet', 'market', 'system'];
  $('#manbox').innerHTML = `
    <p class="kick">the manual</p>
    <h1>put on the <em>mask</em>.</h1>
    <p class="lead">st3alth is a privacy terminal for solana. it shows you what a stranger can already link to any wallet, then gives you the tools to leave a thinner trail: burners born in your tab, reads that never leave your ip with a node, and a screen that keeps your numbers to itself. everything else a trencher needs is here too, in one prompt.</p>
    <h2>what it does</h2>
    <div class="mgrid">${CARDS.map(([k, t, d, run]) => `<div class="mcard"><b>${esc(t)}</b><p>${esc(d)}</p><p style="margin-top:10px"><span class="tok c" data-run="${esc(run)}">${esc(run)}</span></p></div>`).join('')}</div>
    <h2>privacy, honestly</h2>
    <div class="honest"><div><h4>what st3alth hides</h4><ul><li>your name: never asked, no account</li><li>your ip from rpc nodes: every read goes through helius on the server</li><li>your main wallet: a burner signs instead</li><li>your screen: masked mode blurs your numbers</li><li>your browser: no cookies, no analytics, no third-party scripts</li></ul></div>
      <div><h4>what stays public</h4><ul><li>every transaction, forever: it is a public chain</li><li>how a burner was funded: fund it from somewhere new</li><li>your ip, to st3alth, like any website</li><li>amounts and counterparties, unless you use a privacy ring</li><li>anything you link yourself: names, posts, round trips</li></ul></div></div>
    <h2>keys</h2>
    <div class="keys">${KEYS.map(([k, d]) => `<div><span>${esc(d)}</span><kbd>${esc(k)}</kbd></div>`).join('')}</div>
    <h2>commands</h2>
    ${order.filter(g => groups[g]).map(g => `<p class="kick" style="margin-top:22px">${g}</p><div class="keys">${groups[g].map(c => `<div><span class="tok c" data-fill="${esc(c.usage.split(' ')[0])} ">${esc(c.usage)}</span><span class="f" style="text-align:right">${esc(c.help)}</span></div>`).join('')}</div>`).join('')}
    <h2>questions</h2>
    <div class="faqs">${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
    <p class="f" style="margin-top:40px">st3alth is independent and not affiliated with helius, jupiter or pump.fun. nothing here is advice.</p>`;
}
