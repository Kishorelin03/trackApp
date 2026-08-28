const configReady = window.SUPABASE_URL && !window.SUPABASE_URL.includes('YOUR_PROJECT') && window.SUPABASE_ANON_KEY && !window.SUPABASE_ANON_KEY.includes('YOUR_') && window.supabase?.createClient;
const db = configReady ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null;
const list = document.querySelector('#taskList');
const modal = document.querySelector('#modal');
const welcome = document.querySelector('#welcome');
let user = null;
let weeklyTasks = [];
let transactions = [];
let monthlyBudget = 0;
let sendHomeBudget = 0;
let budgetPlans = [];
let jobApplications = [];
let editingJobId = null;
let activeView = localStorage.getItem('trackapp-active-view') || 'planner';
let roadmaps = [], sections = [], topics = [], selectedRoadmapId = null;
let isSignIn = localStorage.getItem('dayflow-auth-mode') === 'signin';

const today = new Date();
const dateKey = date => new Intl.DateTimeFormat('en-CA').format(date);
const todayKey = dateKey(today);
const monthKey = date => dateKey(new Date(date.getFullYear(), date.getMonth(), 1)).slice(0, 7);
let selectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
let calendarCursor = new Date(today.getFullYear(), today.getMonth(), 1);
const weekStart = date => { const start = new Date(date); start.setDate(date.getDate() - ((date.getDay() + 6) % 7)); return start; };
const weekEnd = date => { const end = weekStart(date); end.setDate(end.getDate() + 6); return end; };
const escapeHtml = text => text.replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[char]));
const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));

function setStatus(message = '', isError = false) {
  const status = document.querySelector('#authStatus');
  status.textContent = message;
  status.style.color = isError ? '#b34335' : '#4e8c75';
}
function setAuthMode(signIn) {
  isSignIn = signIn;
  localStorage.setItem('dayflow-auth-mode', signIn ? 'signin' : 'signup');
  document.querySelector('.name-field').style.display = signIn ? 'none' : 'block';
  document.querySelector('#authTitle').innerHTML = signIn ? 'Welcome<br><em>back.</em>' : 'Your days, with<br><em>more meaning.</em>';
  document.querySelector('#authCopy').textContent = signIn ? 'Sign in to return to your weekly rhythm.' : 'Create an account to keep your intentions in sync, wherever you are.';
  document.querySelector('#authSubmit').textContent = signIn ? 'Sign in ✦' : 'Create my account ✦';
  document.querySelector('#authSwitch').textContent = signIn ? 'New here? Create an account' : 'Already have an account? Sign in';
  setStatus();
}
function render() {
  const selectedKey = dateKey(selectedDate);
  const dailyTasks = weeklyTasks.filter(task => task.due_date === selectedKey);
  list.innerHTML = dailyTasks.length ? dailyTasks.map(task => {
    const progress = task.progress ?? (task.completed ? 100 : 0);
    return `<div class="task ${task.completed ? 'completed':''}"><div class="task-main"><button class="check" aria-label="Mark ${escapeHtml(task.title)} complete" data-check="${task.id}">${task.completed ? '✓' : ''}</button><span class="task-name">${escapeHtml(task.title)}</span><span class="category ${task.category}">${task.category}</span><button class="delete" aria-label="Delete task" data-delete="${task.id}">×</button></div><div class="task-progress"><label>PROGRESS <input type="range" min="0" max="100" value="${progress}" data-progress="${task.id}" aria-label="Progress for ${escapeHtml(task.title)}" /><b>${progress}%</b></label></div><textarea class="task-note" data-note="${task.id}" maxlength="500" placeholder="Add a project note — what have you done so far?">${escapeHtml(task.note || '')}</textarea></div>`;
  }).join('') : '<div class="empty-state">No intentions yet. Add one gentle thing to make space for today.</div>';
  const done = weeklyTasks.filter(t => t.completed).length;
  const total = weeklyTasks.length;
  const pct = total ? Math.round(done / total * 100) : 0;
  document.querySelector('#completionText').textContent = pct + '%';
  document.querySelector('#weekScore').textContent = pct;
  document.querySelector('#completionBar').style.width = pct + '%';
  document.querySelector('#doneCount').textContent = done;
  document.querySelector('#totalCount').textContent = total;
  document.querySelector('#energyStatus').textContent = pct === 0 ? 'Ready to begin' : pct >= 80 ? 'Wonderful flow' : pct >= 50 ? 'On track' : 'Building momentum';
  document.querySelector('#energyNote').textContent = total ? `${pct}% of this week complete` : 'No intentions planned this week';
  document.querySelector('#todayDone').textContent = `${dailyTasks.filter(t => t.completed).length} of ${dailyTasks.length} done`;
  const selectedWeekStart = weekStart(selectedDate);
  const activeDays = Array.from({ length: 7 }, (_, index) => {
    const d = new Date(selectedWeekStart); d.setDate(selectedWeekStart.getDate() + index);
    return weeklyTasks.some(t => t.due_date === dateKey(d) && t.completed);
  }).filter(Boolean).length;
  document.querySelector('.consistency .metric-top b').textContent = `${activeDays} day${activeDays === 1 ? '' : 's'}`;
  document.querySelector('#dayPips').innerHTML = Array.from({ length: 7 }, (_, i) => `<i class="${i < activeDays ? 'done' : ''}"></i>`).join('');
  document.querySelector('#selectedDateHeading').textContent = new Intl.DateTimeFormat('en-US', { weekday:'long', day:'numeric', month:'long' }).format(selectedDate).toUpperCase();
  document.querySelector('#intentionsHeading').textContent = selectedKey === todayKey ? 'Today’s intentions' : new Intl.DateTimeFormat('en-US', { month:'long', day:'numeric' }).format(selectedDate) + ' intentions';
  document.querySelector('#selectedDayLabel').textContent = selectedKey === todayKey ? 'today’s gentle progress' : 'selected day’s progress';
  const selectedWeekEnd = weekEnd(selectedDate);
  const rangeStart = new Intl.DateTimeFormat('en-US', { month:'short', day:'numeric' }).format(selectedWeekStart).toUpperCase();
  const rangeEnd = new Intl.DateTimeFormat('en-US', { month:'short', day:'numeric' }).format(selectedWeekEnd).toUpperCase();
  document.querySelector('#weekRange').textContent = `${rangeStart} — ${rangeEnd}`;
  const remaining = Math.max(0, Math.ceil((selectedWeekEnd - selectedDate) / 86400000));
  document.querySelector('#focusDays').textContent = remaining ? `${remaining} day${remaining === 1 ? '' : 's'} left in this week` : 'Last day of this week';
  renderCalendar();
}
function renderCalendar() {
  const monthLabel = new Intl.DateTimeFormat('en-US', { month:'long', year:'numeric' }).format(calendarCursor).toUpperCase();
  document.querySelector('#calendarMonth').textContent = monthLabel;
  const first = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 0).getDate();
  const selectedKey = dateKey(selectedDate);
  document.querySelector('#calendarDates').innerHTML = Array.from({ length: offset + daysInMonth }, (_, index) => {
    if (index < offset) return '<span class="blank"></span>';
    const day = index - offset + 1;
    const date = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), day);
    const key = dateKey(date);
    const count = weeklyTasks.filter(task => task.due_date === key).length;
    return `<button class="${key === selectedKey ? 'active' : ''} ${key === todayKey ? 'today' : ''}" data-date="${key}" aria-label="${key}">${day}${count ? '<i></i>' : ''}</button>`;
  }).join('');
}
async function loadTasks() {
  const { data, error } = await db.from('tasks').select('*').gte('due_date', dateKey(weekStart(selectedDate))).lte('due_date', dateKey(weekEnd(selectedDate))).order('due_date').order('created_at');
  if (error) return alert(`Couldn’t load your tasks: ${error.message}`);
  weeklyTasks = data; render();
}
async function loadBudget() {
  const month = document.querySelector('#budgetMonth').value || monthKey(today);
  const start = `${month}-01`;
  const end = dateKey(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0));
  const [{ data: records, error: transactionError }, { data: budget, error: budgetError }, { data: plans, error: planError }] = await Promise.all([
    db.from('transactions').select('*').gte('transaction_date', start).lte('transaction_date', end).order('transaction_date', { ascending: false }).order('created_at', { ascending: false }),
    db.from('monthly_budgets').select('amount, send_home_amount').eq('month', start).maybeSingle(),
    db.from('budget_plans').select('*').eq('month', start).order('category')
  ]);
  if (transactionError || budgetError || planError) return alert(`Couldn’t load your budget: ${(transactionError || budgetError || planError).message}`);
  transactions = records || []; monthlyBudget = Number(budget?.amount || 0); sendHomeBudget = Number(budget?.send_home_amount || 0); budgetPlans = plans || [];
  document.querySelector('#budgetLimit').value = monthlyBudget || '';
  document.querySelector('#sendHomeLimit').value = sendHomeBudget || '';
  renderBudget();
}
async function loadJobs() {
  const { data, error } = await db.from('job_applications').select('*').order('application_date', { ascending: false }).order('created_at', { ascending: false });
  if (error) return alert(`Couldn’t load applications: ${error.message}`);
  jobApplications = data || [];
  const count = status => jobApplications.filter(job => job.status === status).length;
  document.querySelector('#appliedCount').textContent = count('applied');
  document.querySelector('#interviewCount').textContent = count('interview');
  document.querySelector('#offerCount').textContent = count('offer');
  document.querySelector('#followUpCount').textContent = jobApplications.filter(job => job.follow_up_date && new Date(`${job.follow_up_date}T12:00:00`) >= new Date(todayKey + 'T00:00:00')).length;
  const link = (url, label) => /^https?:\/\//i.test(url || '') ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${label}</a>` : '—';
  document.querySelector('#jobList').innerHTML = jobApplications.length ? jobApplications.map(job => `<tr><td>${new Intl.DateTimeFormat('en-US', { month:'short', day:'numeric', year:'numeric' }).format(new Date(`${job.application_date}T12:00:00`))}${job.follow_up_date ? `<small>Follow up ${new Intl.DateTimeFormat('en-US', { month:'short', day:'numeric' }).format(new Date(`${job.follow_up_date}T12:00:00`))}</small>` : ''}</td><td><strong>${escapeHtml(job.company)}</strong><small>${escapeHtml(job.role)}</small></td><td>${escapeHtml(job.location || '—')}</td><td><span class="job-status ${job.status}">${job.status === 'rejected' ? 'closed' : job.status}</span></td><td>${link(job.resume_link, 'View')}</td><td>${link(job.cover_letter_link, 'View')}</td><td>${escapeHtml(job.contacts || '—')}</td><td>${link(job.portal_link, 'Open')}</td><td>${escapeHtml(job.email || '—')}</td><td>${escapeHtml(job.reference || '—')}<small>${escapeHtml(job.reference_contact || '')}</small></td><td>${link(job.reference_linkedin, 'View')}</td><td><small>${escapeHtml(job.response || job.notes || '—')}</small></td><td><button class="job-edit" data-job-edit="${job.id}">Edit</button><button class="delete" data-job-delete="${job.id}" aria-label="Delete ${escapeHtml(job.company)} application">×</button></td></tr>`).join('') : '<tr><td class="empty-state" colspan="13">No applications yet. Add the first opportunity you’re pursuing.</td></tr>';
}
async function loadRoadmaps() {
  const { data, error } = await db.from('roadmaps').select('*').order('created_at');
  if (error) return alert(`Couldn’t load roadmaps: ${error.message}`);
  roadmaps = data || [];
  if (!selectedRoadmapId && roadmaps.length) selectedRoadmapId = roadmaps[0].id;
  if (selectedRoadmapId && !roadmaps.some(item => item.id === selectedRoadmapId)) selectedRoadmapId = roadmaps[0]?.id || null;
  if (selectedRoadmapId) {
    const { data: loadedSections, error: sectionError } = await db.from('roadmap_sections').select('*').eq('roadmap_id', selectedRoadmapId).order('sort_order').order('created_at');
    if (sectionError) return alert(`Couldn’t load roadmap sections: ${sectionError.message}`);
    sections = loadedSections || [];
    const ids = sections.map(section => section.id);
    if (ids.length) { const { data: loadedTopics, error: topicError } = await db.from('roadmap_topics').select('*').in('section_id', ids).order('sort_order').order('created_at'); if (topicError) return alert(`Couldn’t load roadmap topics: ${topicError.message}`); topics = loadedTopics || []; } else topics = [];
  } else { sections = []; topics = []; }
  renderRoadmaps();
}
function renderRoadmaps() {
  document.querySelector('#roadmapList').innerHTML = roadmaps.length ? roadmaps.map(item => `<button class="roadmap-link ${item.id === selectedRoadmapId ? 'active' : ''}" data-roadmap="${item.id}">${escapeHtml(item.title)}</button>`).join('') : '<small class="empty-state">No roadmaps yet.</small>';
  const roadmap = roadmaps.find(item => item.id === selectedRoadmapId);
  document.querySelector('#roadmapEmpty').hidden = Boolean(roadmap); document.querySelector('#roadmapContent').hidden = !roadmap;
  if (!roadmap) return;
  document.querySelector('#roadmapTitle').textContent = roadmap.title; document.querySelector('#roadmapDescription').textContent = roadmap.description;
  const mastered = topics.filter(topic => topic.mastered).length, progress = topics.length ? Math.round(mastered / topics.length * 100) : 0;
  document.querySelector('#roadmapProgressBar').style.width = `${progress}%`; document.querySelector('#roadmapProgressText').textContent = `${progress}% mastered · ${mastered} of ${topics.length} topics`;
  document.querySelector('#sectionList').innerHTML = sections.map(section => `<div class="roadmap-section" draggable="true" data-section-drag="${section.id}"><div class="roadmap-section-header"><span class="drag-handle" title="Drag to rearrange">⠿</span><h3>${escapeHtml(section.title)}</h3><div><button class="section-add" data-section-edit="${section.id}">Edit</button><button class="section-add" data-add-topic="${section.id}">+ Add topic</button></div></div>${topics.filter(topic => topic.section_id === section.id).map(topic => `<div class="topic-row"><label><input type="checkbox" data-topic-check="${topic.id}" ${topic.mastered ? 'checked' : ''}/><span><strong>${escapeHtml(topic.title)}</strong></span><span class="topic-actions"><button data-topic-edit="${topic.id}">Edit</button><button data-topic-delete="${topic.id}">×</button></span></label>${topic.definition ? `<p>${escapeHtml(topic.definition)}</p>` : ''}${topic.notes ? `<button class="topic-read" data-topic-read="${topic.id}">Read notes →</button>` : ''}</div>`).join('') || '<div class="empty-state">No topics yet. Add the first idea to study.</div>'}</div>`).join('') || '<div class="empty-state">No sections yet. Start by grouping your first set of topics.</div>';
}
function renderBudget() {
  const expenses = transactions.filter(t => t.type === 'expense');
  const income = transactions.filter(t => t.type === 'income');
  const spent = expenses.reduce((sum, t) => sum + Number(t.amount), 0);
  const earned = income.reduce((sum, t) => sum + Number(t.amount), 0);
  const sentHome = expenses.filter(t => t.category === 'Money sent home').reduce((sum, t) => sum + Number(t.amount), 0);
  const personalSpending = expenses.filter(t => t.category !== 'Money sent home').reduce((sum, t) => sum + Number(t.amount), 0);
  const available = monthlyBudget - sendHomeBudget - personalSpending;
  document.querySelector('#availableAmount').textContent = money(available);
  document.querySelector('#availableNote').textContent = monthlyBudget ? `${money(personalSpending)} personal spending + ${money(sendHomeBudget)} reserved` : 'Set a monthly budget to begin';
  document.querySelector('#sendHomeAmount').textContent = money(sendHomeBudget);
  document.querySelector('#sendHomeNote').textContent = sendHomeBudget ? `${money(sentHome)} recorded as sent · ${money(Math.max(0, sendHomeBudget - sentHome))} remaining` : 'Dedicated monthly allocation';
  document.querySelector('#spentAmount').textContent = money(spent);
  document.querySelector('#spentNote').textContent = expenses.length ? `${expenses.length} expense${expenses.length === 1 ? '' : 's'} this month` : 'No expenses recorded';
  document.querySelector('#incomeAmount').textContent = money(earned);
  document.querySelector('#transactionList').innerHTML = transactions.length ? transactions.map(t => `<div class="transaction"><div class="transaction-icon ${t.type}">${t.type === 'income' ? '↗' : '↘'}</div><div class="transaction-detail"><b>${escapeHtml(t.title)}</b><span>${escapeHtml(t.category)} · ${new Intl.DateTimeFormat('en-US', { month:'short', day:'numeric' }).format(new Date(`${t.transaction_date}T12:00:00`))}</span></div><strong class="${t.type}">${t.type === 'income' ? '+' : '−'}${money(t.amount)}</strong><button class="delete transaction-delete" data-transaction-delete="${t.id}" aria-label="Delete ${escapeHtml(t.title)}">×</button></div>`).join('') : '<div class="empty-state">No money records this month. Add income or an expense to begin.</div>';
  const categories = expenses.reduce((result, t) => { result[t.category] = (result[t.category] || 0) + Number(t.amount); return result; }, {});
  const plans = Object.fromEntries(budgetPlans.map(plan => [plan.category, Number(plan.amount)]));
  const names = [...new Set([...Object.keys(categories), ...Object.keys(plans)])];
  const ordered = names.map(name => ({ name, spent: categories[name] || 0, limit: plans[name] || 0 })).sort((a, b) => (b.spent / (b.limit || 1)) - (a.spent / (a.limit || 1)));
  const overPlan = ordered.find(item => item.limit && item.spent > item.limit);
  const closestPlan = ordered.find(item => item.limit && item.spent);
  document.querySelector('#spendingTitle').textContent = overPlan ? `${overPlan.name} is over plan.` : closestPlan ? `${closestPlan.name} needs attention.` : 'Plan your spending.';
  document.querySelector('#categoryBreakdown').innerHTML = ordered.length ? ordered.map(item => { const remaining = item.limit - item.spent; const width = item.limit ? Math.min(100, Math.round(item.spent / item.limit * 100)) : 100; return `<div class="category-row plan-row"><span>${escapeHtml(item.name)}<small>${item.limit ? `${money(item.spent)} of ${money(item.limit)}` : `${money(item.spent)} spent · no plan`}</small></span><div class="${remaining < 0 ? 'over' : ''}"><i style="width:${width}%"></i></div><b>${item.limit ? (remaining >= 0 ? `${money(remaining)} left` : `${money(Math.abs(remaining))} over`) : money(item.spent)}</b><button class="plan-delete" data-plan-delete="${budgetPlans.find(plan => plan.category === item.name)?.id || ''}" ${plans[item.name] ? '' : 'hidden'}>×</button></div>`; }).join('') : '';
  document.querySelector('#spendingInsight').textContent = overPlan ? `You have spent ${money(overPlan.spent)} against a ${money(overPlan.limit)} ${overPlan.name} plan. Consider pausing spending in this category.` : closestPlan ? `You can still spend ${money(Math.max(0, closestPlan.limit - closestPlan.spent))} on ${closestPlan.name} this month.` : 'Set a category plan to see exactly what you can still spend.';
}
const reflections = ['A small step, repeated, becomes a remarkable distance.', 'Make room for the life you want with one thoughtful action.', 'Progress is quiet at first. Keep showing up for it.', 'You do not need a perfect day to make a meaningful one.', 'Today’s effort is a kind note to your future self.'];
function loadReflection(next = false) {
  const storageKey = 'trackapp-reflection-index';
  const current = Number(localStorage.getItem(storageKey) || 0);
  const index = next ? (current + 1) % reflections.length : current % reflections.length;
  localStorage.setItem(storageKey, index);
  document.querySelector('#reflectionQuote').textContent = `“${reflections[index]}”`;
}
async function setUser(nextUser) {
  user = nextUser;
  if (!user) { welcome.classList.remove('hidden'); return; }
  const name = user.user_metadata?.name || user.email.split('@')[0];
  localStorage.removeItem('dayflow-auth-mode');
  document.querySelector('#userName').textContent = name;
  document.querySelector('.avatar').textContent = name.charAt(0).toUpperCase();
  document.querySelector('#settingsEmail').textContent = user.email;
  welcome.classList.add('hidden');
  await loadTasks();
  loadReflection();
  await loadBudget();
  await loadJobs();
  await loadRoadmaps();
}

document.querySelector('#authSwitch').onclick = () => setAuthMode(!isSignIn);
setAuthMode(isSignIn);
document.querySelector('#authForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!db) return setStatus('Add your Supabase URL and publishable key in supabase-config.js first.', true);
  const email = document.querySelector('#emailInput').value.trim();
  const password = document.querySelector('#passwordInput').value;
  const name = document.querySelector('#nameInput').value.trim();
  const button = document.querySelector('#authSubmit'); button.disabled = true; button.textContent = 'One moment…';
  try {
    const result = isSignIn ? await db.auth.signInWithPassword({ email, password }) : await db.auth.signUp({ email, password, options: { data: { name } } });
    if (result.error) return setStatus(`Authentication failed: ${result.error.message}`, true);
    if (!result.data.session) { setAuthMode(true); return setStatus('Account created. Check your inbox to confirm your email, then sign in.'); }
    await setUser(result.data.user);
  } catch (error) {
    setStatus(`Connection failed: ${error.message || 'Check your browser network and Supabase settings.'}`, true);
  } finally {
    button.disabled = false;
    button.textContent = isSignIn ? 'Sign in ✦' : 'Create my account ✦';
  }
});
document.querySelector('#openModal').onclick = () => { document.querySelector('#taskDate').value = dateKey(selectedDate); modal.classList.add('show'); document.querySelector('#taskTitle').focus(); };
document.querySelector('#closeModal').onclick = () => modal.classList.remove('show');
modal.addEventListener('click', event => { if (event.target === modal) modal.classList.remove('show'); });
document.querySelector('#taskForm').addEventListener('submit', async event => {
  event.preventDefault();
  const titleInput = document.querySelector('#taskTitle');
  const dueDate = document.querySelector('#taskDate').value;
  const { data, error } = await db.from('tasks').insert({ user_id: user.id, title: titleInput.value.trim(), category: document.querySelector('#taskCategory').value, due_date: dueDate, progress: 0, note: '' }).select().single();
  if (error) return alert(`Couldn’t save your intention: ${error.message}`);
  selectedDate = new Date(`${dueDate}T12:00:00`); calendarCursor = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  event.target.reset(); modal.classList.remove('show'); await loadTasks();
});
document.querySelector('#previousMonth').onclick = () => { calendarCursor.setMonth(calendarCursor.getMonth() - 1); renderCalendar(); };
document.querySelector('#nextMonth').onclick = () => { calendarCursor.setMonth(calendarCursor.getMonth() + 1); renderCalendar(); };
document.querySelector('#calendarDates').addEventListener('click', async event => {
  const key = event.target.closest('button')?.dataset.date;
  if (!key) return;
  selectedDate = new Date(`${key}T12:00:00`);
  await loadTasks();
});
list.addEventListener('click', async event => {
  const id = event.target.dataset.check || event.target.dataset.delete;
  if (!id) return;
  const task = weeklyTasks.find(item => item.id === id);
  if (event.target.dataset.check) {
    const completed = !task.completed;
    const { error } = await db.from('tasks').update({ completed, progress: completed ? 100 : 0, completed_at: completed ? new Date().toISOString() : null }).eq('id', id);
    if (error) return alert(`Couldn’t update this task: ${error.message}`);
    task.completed = completed; task.progress = completed ? 100 : 0; render();
  } else {
    const { error } = await db.from('tasks').delete().eq('id', id);
    if (error) return alert(`Couldn’t delete this task: ${error.message}`);
    weeklyTasks = weeklyTasks.filter(item => item.id !== id); render();
  }
});
list.addEventListener('input', event => {
  if (!event.target.dataset.progress) return;
  event.target.parentElement.querySelector('b').textContent = `${event.target.value}%`;
});
list.addEventListener('change', async event => {
  const id = event.target.dataset.progress;
  if (!id) return;
  const task = weeklyTasks.find(item => item.id === id);
  const progress = Number(event.target.value);
  const completed = progress === 100;
  const { error } = await db.from('tasks').update({ progress, completed, completed_at: completed ? new Date().toISOString() : null }).eq('id', id);
  if (error) return alert(`Couldn’t save progress: ${error.message}`);
  task.progress = progress; task.completed = completed; render();
});
list.addEventListener('focusout', async event => {
  const id = event.target.dataset.note;
  if (!id) return;
  const task = weeklyTasks.find(item => item.id === id);
  const note = event.target.value.trim();
  if (note === (task.note || '')) return;
  const { error } = await db.from('tasks').update({ note }).eq('id', id);
  if (error) return alert(`Couldn’t save your note: ${error.message}`);
  task.note = note;
});
function showView(view) {
  const views = { planner: '#plannerView', budget: '#budgetSection', jobs: '#jobsView', roadmaps: '#roadmapsView', settings: '#settingsView' };
  if (!views[view]) view = 'planner';
  activeView = view;
  localStorage.setItem('trackapp-active-view', view);
  document.querySelectorAll('.app-view').forEach(element => element.classList.remove('active'));
  document.querySelector(views[view]).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  if (view === 'budget' && user) loadBudget();
  if (view === 'jobs' && user) loadJobs();
  if (view === 'roadmaps' && user) loadRoadmaps();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
document.querySelector('.avatar').onclick = () => showView('settings');
document.querySelector('#signOutButton').onclick = async () => { if (confirm('Sign out of TrackApp?')) await db.auth.signOut(); };
showView(activeView);
document.querySelector('#refreshQuote').onclick = () => loadReflection(true);
const transactionModal = document.querySelector('#transactionModal');
const transactionCategories = {
  expense: ['Food & dining', 'Transport', 'Shopping', 'Bills & utilities', 'Health & wellness', 'Entertainment', 'Education', 'Money sent home', 'Other'],
  income: ['Salary', 'Freelance', 'Business', 'Investment', 'Gift', 'Refund', 'Other income']
};
function updateTransactionForm() {
  const type = document.querySelector('#transactionType').value;
  const isIncome = type === 'income';
  document.querySelector('#recordEyebrow').textContent = isIncome ? 'INCOME RECORD' : 'EXPENSE RECORD';
  document.querySelector('#recordTitle').innerHTML = isIncome ? 'Celebrate what<br>comes in.' : 'Make every dollar<br>visible.';
  document.querySelector('#descriptionLabel').childNodes[0].textContent = isIncome ? 'WHERE DID IT COME FROM?' : 'WHAT DID YOU PAY FOR?';
  document.querySelector('#transactionTitle').placeholder = isIncome ? 'e.g. August salary' : 'e.g. Groceries';
  document.querySelector('#amountLabel').childNodes[0].textContent = isIncome ? 'AMOUNT RECEIVED ' : 'AMOUNT SPENT ';
  document.querySelector('#recordSubmit').textContent = isIncome ? 'Save income ✦' : 'Save expense ✦';
  document.querySelector('#transactionCategory').innerHTML = transactionCategories[type].map(category => `<option>${category}</option>`).join('');
}
document.querySelector('#budgetMonth').value = monthKey(today);
document.querySelector('#budgetMonth').addEventListener('change', loadBudget);
function moveBudgetMonth(offset) {
  const [year, month] = document.querySelector('#budgetMonth').value.split('-').map(Number);
  const next = new Date(year, month - 1 + offset, 1);
  document.querySelector('#budgetMonth').value = monthKey(next);
  loadBudget();
}
document.querySelector('#previousBudgetMonth').onclick = () => moveBudgetMonth(-1);
document.querySelector('#nextBudgetMonth').onclick = () => moveBudgetMonth(1);
document.querySelector('#saveBudget').onclick = async () => {
  const month = document.querySelector('#budgetMonth').value;
  const amount = Number(document.querySelector('#budgetLimit').value || 0);
  const sendHomeAmount = Number(document.querySelector('#sendHomeLimit').value || 0);
  const { error } = await db.from('monthly_budgets').upsert({ user_id: user.id, month: `${month}-01`, amount, send_home_amount: sendHomeAmount }, { onConflict: 'user_id,month' });
  if (error) return alert(`Couldn’t save budget: ${error.message}`);
  monthlyBudget = amount; sendHomeBudget = sendHomeAmount; renderBudget();
};
document.querySelector('#openTransaction').onclick = () => { document.querySelector('#transactionType').value = 'expense'; updateTransactionForm(); document.querySelector('#transactionDate').value = todayKey; transactionModal.classList.add('show'); document.querySelector('#transactionTitle').focus(); };
document.querySelector('#closeTransaction').onclick = () => transactionModal.classList.remove('show');
transactionModal.addEventListener('click', event => { if (event.target === transactionModal) transactionModal.classList.remove('show'); });
document.querySelector('#transactionType').addEventListener('change', updateTransactionForm);
document.querySelector('#transactionForm').addEventListener('submit', async event => {
  event.preventDefault();
  const record = { user_id: user.id, type: document.querySelector('#transactionType').value, title: document.querySelector('#transactionTitle').value.trim(), category: document.querySelector('#transactionCategory').value, amount: Number(document.querySelector('#transactionAmount').value), transaction_date: document.querySelector('#transactionDate').value };
  const { error } = await db.from('transactions').insert(record);
  if (error) return alert(`Couldn’t save record: ${error.message}`);
  document.querySelector('#budgetMonth').value = record.transaction_date.slice(0, 7);
  event.target.reset(); transactionModal.classList.remove('show'); await loadBudget();
});
document.querySelector('#transactionList').addEventListener('click', async event => {
  const id = event.target.dataset.transactionDelete;
  if (!id) return;
  const { error } = await db.from('transactions').delete().eq('id', id);
  if (error) return alert(`Couldn’t remove expense: ${error.message}`);
  transactions = transactions.filter(t => t.id !== id); renderBudget();
});
const planModal = document.querySelector('#planModal');
document.querySelector('#openPlan').onclick = () => { document.querySelector('#planAmount').value = ''; planModal.classList.add('show'); document.querySelector('#planAmount').focus(); };
document.querySelector('#closePlan').onclick = () => planModal.classList.remove('show');
planModal.addEventListener('click', event => { if (event.target === planModal) planModal.classList.remove('show'); });
document.querySelector('#planForm').addEventListener('submit', async event => {
  event.preventDefault();
  const month = document.querySelector('#budgetMonth').value;
  const category = document.querySelector('#planCategory').value;
  const amount = Number(document.querySelector('#planAmount').value);
  const { error } = await db.from('budget_plans').upsert({ user_id: user.id, month: `${month}-01`, category, amount }, { onConflict: 'user_id,month,category' });
  if (error) return alert(`Couldn’t save category plan: ${error.message}`);
  event.target.reset(); planModal.classList.remove('show'); await loadBudget();
});
document.querySelector('#categoryBreakdown').addEventListener('click', async event => {
  const id = event.target.dataset.planDelete;
  if (!id) return;
  const { error } = await db.from('budget_plans').delete().eq('id', id);
  if (error) return alert(`Couldn’t remove category plan: ${error.message}`);
  budgetPlans = budgetPlans.filter(plan => plan.id !== id); renderBudget();
});
const jobModal = document.querySelector('#jobModal');
function openJobForm(job = null) {
  editingJobId = job?.id || null;
  document.querySelector('#jobForm').reset();
  document.querySelector('#jobModalTitle').innerHTML = job ? 'Update this<br>opportunity.' : 'Capture the<br>opportunity.';
  document.querySelector('#jobSubmit').textContent = job ? 'Save changes ✦' : 'Save application ✦';
  if (job) {
    document.querySelector('#jobCompany').value = job.company;
    document.querySelector('#jobRole').value = job.role;
    document.querySelector('#jobLocation').value = job.location || '';
    document.querySelector('#jobDate').value = job.application_date;
    document.querySelector('#jobStatus').value = job.status;
    document.querySelector('#jobFollowUp').value = job.follow_up_date || '';
    document.querySelector('#jobResumeLink').value = job.resume_link || '';
    document.querySelector('#jobCoverLetterLink').value = job.cover_letter_link || '';
    document.querySelector('#jobContacts').value = job.contacts || '';
    document.querySelector('#jobEmail').value = job.email || '';
    document.querySelector('#jobPortalLink').value = job.portal_link || '';
    document.querySelector('#jobReference').value = job.reference || '';
    document.querySelector('#jobReferenceContact').value = job.reference_contact || '';
    document.querySelector('#jobReferenceLinkedin').value = job.reference_linkedin || '';
    document.querySelector('#jobResponse').value = job.response || job.notes || '';
  } else document.querySelector('#jobDate').value = todayKey;
  jobModal.classList.add('show'); document.querySelector('#jobCompany').focus();
}
document.querySelector('#openJob').onclick = () => openJobForm();
document.querySelector('#closeJob').onclick = () => jobModal.classList.remove('show');
jobModal.addEventListener('click', event => { if (event.target === jobModal) jobModal.classList.remove('show'); });
document.querySelector('#jobForm').addEventListener('submit', async event => {
  event.preventDefault();
  const application = { user_id: user.id, company: document.querySelector('#jobCompany').value.trim(), role: document.querySelector('#jobRole').value.trim(), location: document.querySelector('#jobLocation').value.trim(), status: document.querySelector('#jobStatus').value, application_date: document.querySelector('#jobDate').value, follow_up_date: document.querySelector('#jobFollowUp').value || null, resume_link: document.querySelector('#jobResumeLink').value.trim(), cover_letter_link: document.querySelector('#jobCoverLetterLink').value.trim(), contacts: document.querySelector('#jobContacts').value.trim(), email: document.querySelector('#jobEmail').value.trim(), portal_link: document.querySelector('#jobPortalLink').value.trim(), reference: document.querySelector('#jobReference').value.trim(), reference_contact: document.querySelector('#jobReferenceContact').value.trim(), reference_linkedin: document.querySelector('#jobReferenceLinkedin').value.trim(), response: document.querySelector('#jobResponse').value.trim() };
  const result = editingJobId ? await db.from('job_applications').update(application).eq('id', editingJobId) : await db.from('job_applications').insert(application);
  if (result.error) return alert(`Couldn’t save application: ${result.error.message}`);
  editingJobId = null;
  event.target.reset(); jobModal.classList.remove('show'); await loadJobs();
});
document.querySelector('#jobList').addEventListener('click', async event => {
  const editId = event.target.dataset.jobEdit;
  if (editId) return openJobForm(jobApplications.find(job => job.id === editId));
  const id = event.target.dataset.jobDelete;
  if (!id) return;
  const { error } = await db.from('job_applications').delete().eq('id', id);
  if (error) return alert(`Couldn’t remove application: ${error.message}`);
  jobApplications = jobApplications.filter(job => job.id !== id); await loadJobs();
});
const roadmapModal = document.querySelector('#roadmapModal'), sectionModal = document.querySelector('#sectionModal'), topicModal = document.querySelector('#topicModal'), notesModal = document.querySelector('#notesModal');
let topicSectionId = null, editingTopicId = null, editingRoadmapId = null, editingSectionId = null;
const closeModal = modal => modal.classList.remove('show');
function openRoadmapForm(roadmap = null) { editingRoadmapId = roadmap?.id || null; document.querySelector('#roadmapForm').reset(); document.querySelector('#roadmapModalTitle').innerHTML = roadmap ? 'Refine your<br>learning path.' : 'Create your<br>learning path.'; document.querySelector('#roadmapSubmit').textContent = roadmap ? 'Save changes ✦' : 'Create roadmap ✦'; if (roadmap) { document.querySelector('#newRoadmapTitle').value = roadmap.title; document.querySelector('#newRoadmapDescription').value = roadmap.description; } roadmapModal.classList.add('show'); document.querySelector('#newRoadmapTitle').focus(); }
document.querySelector('#openRoadmap').onclick = () => openRoadmapForm();
document.querySelector('#editRoadmap').onclick = () => openRoadmapForm(roadmaps.find(item => item.id === selectedRoadmapId));
document.querySelector('#closeRoadmap').onclick = () => closeModal(roadmapModal);
document.querySelector('#closeSection').onclick = () => closeModal(sectionModal);
document.querySelector('#closeTopic').onclick = () => closeModal(topicModal);
document.querySelector('#closeNotes').onclick = () => closeModal(notesModal);
[roadmapModal, sectionModal, topicModal, notesModal].forEach(modal => modal.addEventListener('click', event => { if (event.target === modal) closeModal(modal); }));
document.querySelector('#roadmapForm').addEventListener('submit', async event => { event.preventDefault(); const value = { user_id: user.id, title: document.querySelector('#newRoadmapTitle').value.trim(), description: document.querySelector('#newRoadmapDescription').value.trim() }; const result = editingRoadmapId ? await db.from('roadmaps').update(value).eq('id', editingRoadmapId).select().single() : await db.from('roadmaps').insert(value).select().single(); if (result.error) return alert(`Couldn’t save roadmap: ${result.error.message}`); selectedRoadmapId = result.data.id; closeModal(roadmapModal); await loadRoadmaps(); });
function openSectionForm(section = null) { editingSectionId = section?.id || null; document.querySelector('#sectionForm').reset(); document.querySelector('#sectionModalTitle').innerHTML = section ? 'Refine this<br>section.' : 'Group the ideas<br>that belong together.'; document.querySelector('#sectionSubmit').textContent = section ? 'Save changes ✦' : 'Add section ✦'; if (section) document.querySelector('#newSectionTitle').value = section.title; sectionModal.classList.add('show'); document.querySelector('#newSectionTitle').focus(); }
document.querySelector('#openSection').onclick = () => openSectionForm();
document.querySelector('#sectionForm').addEventListener('submit', async event => { event.preventDefault(); const value = { roadmap_id: selectedRoadmapId, title: document.querySelector('#newSectionTitle').value.trim(), sort_order: sections.length }; const result = editingSectionId ? await db.from('roadmap_sections').update(value).eq('id', editingSectionId) : await db.from('roadmap_sections').insert(value); if (result.error) return alert(`Couldn’t save section: ${result.error.message}`); closeModal(sectionModal); await loadRoadmaps(); });
function openTopic(sectionId, topic = null) { topicSectionId = sectionId; editingTopicId = topic?.id || null; document.querySelector('#topicForm').reset(); if (topic) { document.querySelector('#newTopicTitle').value = topic.title; document.querySelector('#newTopicDefinition').value = topic.definition; document.querySelector('#newTopicNotes').value = topic.notes; } topicModal.classList.add('show'); document.querySelector('#newTopicTitle').focus(); }
document.querySelector('#topicForm').addEventListener('submit', async event => { event.preventDefault(); const value = { section_id: topicSectionId, title: document.querySelector('#newTopicTitle').value.trim(), definition: document.querySelector('#newTopicDefinition').value.trim(), notes: document.querySelector('#newTopicNotes').value.trim(), sort_order: topics.filter(topic => topic.section_id === topicSectionId).length }; const result = editingTopicId ? await db.from('roadmap_topics').update(value).eq('id', editingTopicId) : await db.from('roadmap_topics').insert(value); if (result.error) return alert(`Couldn’t save topic: ${result.error.message}`); closeModal(topicModal); await loadRoadmaps(); });
document.querySelector('#roadmapList').addEventListener('click', async event => { const id = event.target.dataset.roadmap; if (!id) return; selectedRoadmapId = id; await loadRoadmaps(); });
document.querySelector('#sectionList').addEventListener('click', async event => { const readId = event.target.dataset.topicRead; if (readId) { const topic = topics.find(item => item.id === readId); document.querySelector('#notesReaderTitle').textContent = topic.title; document.querySelector('#notesReaderDefinition').textContent = topic.definition || 'No definition saved yet.'; document.querySelector('#notesReaderBody').textContent = topic.notes; return notesModal.classList.add('show'); } const sectionEditId = event.target.dataset.sectionEdit; if (sectionEditId) return openSectionForm(sections.find(section => section.id === sectionEditId)); const sectionId = event.target.dataset.addTopic; if (sectionId) return openTopic(sectionId); const editId = event.target.dataset.topicEdit; if (editId) { const topic = topics.find(item => item.id === editId); return openTopic(topic.section_id, topic); } const deleteId = event.target.dataset.topicDelete; if (deleteId) { const { error } = await db.from('roadmap_topics').delete().eq('id', deleteId); if (error) return alert(`Couldn’t delete topic: ${error.message}`); return loadRoadmaps(); } });
document.querySelector('#sectionList').addEventListener('change', async event => { const id = event.target.dataset.topicCheck; if (!id) return; const { error } = await db.from('roadmap_topics').update({ mastered: event.target.checked }).eq('id', id); if (error) return alert(`Couldn’t update topic: ${error.message}`); await loadRoadmaps(); });
let draggedSectionId = null;
const sectionList = document.querySelector('#sectionList');
sectionList.addEventListener('dragstart', event => { const element = event.target.closest('[data-section-drag]'); if (!element) return; draggedSectionId = element.dataset.sectionDrag; element.classList.add('dragging'); event.dataTransfer.effectAllowed = 'move'; });
sectionList.addEventListener('dragover', event => { const target = event.target.closest('[data-section-drag]'); if (!target || target.dataset.sectionDrag === draggedSectionId) return; event.preventDefault(); document.querySelectorAll('.roadmap-section.drag-over').forEach(item => item.classList.remove('drag-over')); target.classList.add('drag-over'); });
sectionList.addEventListener('dragleave', event => event.target.closest('[data-section-drag]')?.classList.remove('drag-over'));
sectionList.addEventListener('dragend', () => document.querySelectorAll('.roadmap-section.dragging, .roadmap-section.drag-over').forEach(item => item.classList.remove('dragging', 'drag-over')));
sectionList.addEventListener('drop', async event => { const target = event.target.closest('[data-section-drag]'); if (!target || !draggedSectionId || target.dataset.sectionDrag === draggedSectionId) return; event.preventDefault(); const from = sections.findIndex(section => section.id === draggedSectionId), to = sections.findIndex(section => section.id === target.dataset.sectionDrag); const [moved] = sections.splice(from, 1); sections.splice(to, 0, moved); const results = await Promise.all(sections.map((section, index) => db.from('roadmap_sections').update({ sort_order: index }).eq('id', section.id))); const error = results.find(result => result.error)?.error; if (error) return alert(`Couldn’t rearrange sections: ${error.message}`); await loadRoadmaps(); });
document.querySelector('#todayDate').textContent = new Intl.DateTimeFormat('en-US', { weekday:'long', month:'short', day:'numeric' }).format(today).toUpperCase();

if (window.location.protocol === 'file:') setStatus('Open this app through http://localhost:5500 — Supabase Auth cannot complete reliably from a file:// URL.', true);
else if (!configReady) setStatus('Supabase did not load. Check your URL/key in supabase-config.js and refresh.', true);
else {
  db.auth.getSession().then(({ data, error }) => {
    if (error) setStatus(`Supabase session error: ${error.message}`, true);
    else setUser(data.session?.user || null);
  }).catch(error => setStatus(`Supabase connection error: ${error.message}`, true));
  db.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
}
