/* Set a new password after clicking the link from the reset email */
const show = id => {
  ['formCard','expiredCard','doneCard'].forEach(x => document.getElementById(x).hidden = x !== id);
  document.getElementById('checking').hidden = true;
};

let recovering = false;
db.auth.onAuthStateChange((event) => {
  if(event === 'PASSWORD_RECOVERY'){ recovering = true; show('formCard'); }
});

(async function check(){
  // the reset link logs the visitor in for this page only
  const { data } = await db.auth.getSession();
  if(data.session && !recovering){ recovering = true; show('formCard'); }
  setTimeout(() => { if(!recovering) show('expiredCard'); }, 1200);
})();

document.getElementById('resetForm').addEventListener('submit', async e => {
  e.preventDefault();
  const out = document.getElementById('resetMsg');
  const a = document.getElementById('newPw').value, b = document.getElementById('newPw2').value;
  if(a.length < 8) { out.textContent = 'Password must be at least 8 characters.'; out.className = 'msg err'; return; }
  if(a !== b) { out.textContent = 'Passwords do not match.'; out.className = 'msg err'; return; }
  const btn = document.getElementById('resetBtn'); btn.disabled = true;
  const { error } = await db.auth.updateUser({ password: a });
  btn.disabled = false;
  if(error){ out.textContent = authErrorText(error); out.className = 'msg err'; return; }
  await db.auth.signOut();
  show('doneCard');
});
