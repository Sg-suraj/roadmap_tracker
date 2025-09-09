document.addEventListener('DOMContentLoaded', () => {

    const kanbanBoard = document.getElementById('kanban-board');
    const pageBody = document.body;

    // --- Helper Functions ---
    async function fetchData(url, method = 'GET', data = null) {
        const options = { method, headers: { 'Content-Type': 'application/json' } };
        if (data) {
            options.body = JSON.stringify(data);
        }
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }

    function showModal(modal) { if(modal) modal.classList.add('show'); }
    function hideModal(modal) { if(modal) modal.classList.remove('show'); }

    function updateTaskCounts() {
        document.querySelectorAll('.kanban-column').forEach(column => {
            const count = column.querySelectorAll('.task-card').length;
            const countEl = column.querySelector('.task-count');
            if (countEl) countEl.textContent = count;
        });
    }

    function createTaskCard(task) {
        const card = document.createElement('li');
        card.className = 'task-card';
        card.id = `task-${task.id}`;
        card.dataset.id = task.id;
        card.dataset.status = task.status;
        card.dataset.week = task.week_number;
        const priorityColor = task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#f59e0b' : '#22c55e';
        card.style.borderLeftColor = priorityColor;
        const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No Due Date';
        card.innerHTML = `
            <h3>${task.title}</h3>
            <p>${task.description || ''}</p>
            <div class="task-card-meta">
                <span><i class="fas fa-calendar-alt"></i> ${dueDate}</span>
                <span><i class="fas fa-flag"></i> ${task.priority}</span>
            </div>
        `;
        return card;
    }
    
    function renderTasks(tasks) {
        const todoList = document.getElementById('todo-list');
        const inProgressList = document.getElementById('in-progress-list');
        const doneList = document.getElementById('done-list');
        [todoList, inProgressList, doneList].forEach(list => { if(list) list.innerHTML = ''; });
        tasks.forEach(task => {
            const card = createTaskCard(task);
            if (task.status === 'todo' && todoList) todoList.appendChild(card);
            if (task.status === 'in_progress' && inProgressList) inProgressList.appendChild(card);
            if (task.status === 'done' && doneList) doneList.appendChild(card);
        });
        updateTaskCounts();
    }

    // --- Modal Logic ---
    const newTaskModal = document.getElementById('new-task-modal');
    const newTaskForm = document.getElementById('new-task-form');
    const editTaskModal = document.getElementById('edit-task-modal');
    const editTaskForm = document.getElementById('edit-task-form');
    const newWeekModal = document.getElementById('new-week-modal');
    const newWeekForm = document.getElementById('new-week-form');
    const editWeekModal = document.getElementById('edit-week-modal');
    const editWeekForm = document.getElementById('edit-week-form');

    document.querySelectorAll('.modal-container').forEach(modal => {
        modal?.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-container')) hideModal(modal);
        });
    });
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn?.addEventListener('click', (e) => hideModal(e.target.closest('.modal-container')));
    });

    document.getElementById('add-week-btn')?.addEventListener('click', () => showModal(newWeekModal));
    document.getElementById('add-task-btn')?.addEventListener('click', () => {
        if (kanbanBoard && newTaskForm) {
            newTaskForm.querySelector('[name="week_number"]').value = kanbanBoard.dataset.week;
        }
        showModal(newTaskModal);
    });

    // --- Form Submissions ---
    newWeekForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(newWeekForm);
        const data = Object.fromEntries(formData.entries());
        data.week_number = parseInt(data.week_number);
        try {
            await fetchData('/api/week', 'POST', data);
            window.location.reload(); 
        } catch (error) {
            console.error('Error creating week:', error);
        }
    });

    editWeekForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const weekNumber = document.getElementById('edit-week-number').value;
        const formData = new FormData(editWeekForm);
        const data = Object.fromEntries(formData.entries());
        try {
            await fetchData(`/api/week/${weekNumber}`, 'PUT', data);
            window.location.reload();
        } catch (error) {
            console.error('Error updating week:', error);
        }
    });
    
    // --- Initial Data Load & Page-Specific Logic ---
    const page = pageBody.dataset.page;
    
    if (page === 'dashboard') {
        const weeksGrid = document.querySelector('.weeks-grid');
        
        async function loadDashboardData() {
            try {
                const weeks = await fetchData('/api/weeks');
                const totalTasks = weeks.reduce((sum, week) => sum + week.progress.total, 0);
                const completedTasks = weeks.reduce((sum, week) => sum + week.progress.done, 0);
                const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                
                document.getElementById('active-weeks').textContent = weeks.length;
                document.getElementById('total-tasks').textContent = totalTasks;
                document.getElementById('completed-tasks').textContent = completedTasks;
                document.getElementById('overall-progress').textContent = `${overallProgress}%`;

                // ## RESTORED -- This logic correctly populates the week cards on page load ##
                weeks.forEach(week => {
                    const weekCard = weeksGrid.querySelector(`.week-card[data-week-number="${week.week_number}"]`);
                    if (weekCard) {
                        weekCard.querySelector('.progress-bar').style.width = `${week.progress.percentage}%`;
                        weekCard.querySelector('.total-tasks').textContent = `${week.progress.total} tasks`;
                        weekCard.querySelector('.progress-percentage').textContent = `${week.progress.percentage}%`;
                        weekCard.querySelector('.todo-count').textContent = week.progress.todo;
                        weekCard.querySelector('.inprogress-count').textContent = week.progress.in_progress;
                        weekCard.querySelector('.done-count').textContent = week.progress.done;
                    }
                });
            } catch (error) {
                console.error('Error loading dashboard data:', error);
            }
        }
        
        loadDashboardData();

        // ## NEW & IMPROVED -- This single listener handles both edit and delete ##
        weeksGrid?.addEventListener('click', async (e) => {
            const targetButton = e.target.closest('.delete-week-btn, .edit-week-btn');
            if (!targetButton) return;

            const weekCard = targetButton.closest('.week-card');
            const weekNumber = weekCard.dataset.weekNumber;

            if (targetButton.classList.contains('delete-week-btn')) {
                if (confirm(`Are you sure you want to delete Week ${weekNumber} and all its tasks? This cannot be undone.`)) {
                    try {
                        await fetchData(`/api/week/${weekNumber}`, 'DELETE');
                        weekCard.remove();
                        loadDashboardData(); 
                    } catch (error) {
                        console.error('Error deleting week:', error);
                        alert('Failed to delete the week. Please try again.');
                    }
                }
            }
            
            if (targetButton.classList.contains('edit-week-btn')) {
                 try {
                    const weekData = await fetchData(`/api/week/${weekNumber}`);
                    document.getElementById('edit-week-number').value = weekData.week_number;
                    document.getElementById('edit_week_title').value = weekData.title;
                    document.getElementById('edit_week_goal').value = weekData.goal;
                    showModal(editWeekModal);
                } catch (error) {
                    console.error('Error fetching week data for edit:', error);
                }
            }
        });

    } else if (page === 'week_board') {
        async function loadBoardData() {
            try {
                const weekNumber = kanbanBoard.dataset.week;
                const tasks = await fetchData(`/api/week/${weekNumber}/tasks`);
                renderTasks(tasks);
                const progress = await fetchData(`/api/week/${weekNumber}/progress`);
                document.getElementById('progress-text').textContent = `${progress.done} of ${progress.total} tasks completed (${progress.percentage}%)`;
            } catch (error) {
                console.error('Error loading board data:', error);
            }
        }
        loadBoardData();
        // ... (other week_board logic like drag-drop, task forms, etc. would go here)
    }
});