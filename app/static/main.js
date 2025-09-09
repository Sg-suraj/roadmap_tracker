document.addEventListener('DOMContentLoaded', () => {

    const kanbanBoard = document.getElementById('kanban-board');
    const pageBody = document.body;

    // --- Helper Functions ---
    async function fetchData(url, method = 'GET', data = null) {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (data) {
            options.body = JSON.stringify(data);
        }
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }

    function showModal(modal) {
        modal.classList.add('show');
    }

    function hideModal(modal) {
        modal.classList.remove('show');
    }

    function updateTaskCounts() {
        document.querySelectorAll('.kanban-column').forEach(column => {
            const count = column.querySelectorAll('.task-card').length;
            const countEl = column.querySelector('.task-count');
            if (countEl) {
                countEl.textContent = count;
            }
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
        
        const createdDate = task.created_at ? new Date(task.created_at).toLocaleDateString() : '';
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
    
        [todoList, inProgressList, doneList].forEach(list => list.innerHTML = '');
    
        tasks.forEach(task => {
            const card = createTaskCard(task);
            if (task.status === 'todo') todoList.appendChild(card);
            if (task.status === 'in_progress') inProgressList.appendChild(card);
            if (task.status === 'done') doneList.appendChild(card);
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
        modal.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-container')) hideModal(modal);
        });
    });
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => hideModal(e.target.closest('.modal-container')));
    });

    // Event listeners for opening modals
    document.getElementById('add-week-btn')?.addEventListener('click', () => showModal(newWeekModal));
    document.getElementById('add-task-btn')?.addEventListener('click', () => {
        const weekNumber = kanbanBoard ? kanbanBoard.dataset.week : null;
        if (weekNumber) {
            document.querySelector('#new-task-form [name="week_number"]').value = weekNumber;
        }
        showModal(newTaskModal);
    });
    document.querySelectorAll('.edit-week-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const weekNumber = e.target.closest('.week-card').dataset.weekNumber;
            try {
                const week = await fetchData(`/api/week/${weekNumber}`);
                document.getElementById('edit-week-number').value = week.week_number;
                document.getElementById('edit_week_title').value = week.title;
                document.getElementById('edit_week_goal').value = week.goal;
                showModal(editWeekModal);
            } catch (error) {
                console.error('Error fetching week data:', error);
            }
        });
    });
    
    // --- Kanban Board and Drag-and-Drop ---
    if (kanbanBoard) {
        const columns = kanbanBoard.querySelectorAll('.task-list');
        columns.forEach(column => {
            new Sortable(column, {
                group: 'tasks',
                animation: 150,
                ghostClass: 'ghost-card',
                onEnd: async function(evt) {
                    const newStatus = evt.to.id.replace('-list', '');
                    const newWeek = kanbanBoard.dataset.week;
                    
                    const movedTasks = Array.from(evt.to.children).map((task, index) => ({
                        id: task.dataset.id,
                        status: newStatus,
                        order_index: index,
                        week_number: parseInt(newWeek)
                    }));
                    
                    try {
                        await fetchData('/api/tasks/reorder', 'POST', { tasks: movedTasks });
                        updateTaskCounts();
                        const progress = await fetchData(`/api/week/${newWeek}/progress`);
                        document.getElementById('progress-text').textContent = `${progress.done} of ${progress.total} tasks completed (${progress.percentage}%)`;
                    } catch (error) {
                        console.error('Error updating task order:', error);
                    }
                }
            });
        });
        
        kanbanBoard.addEventListener('dblclick', async (e) => {
            const card = e.target.closest('.task-card');
            if (card) {
                const taskId = card.dataset.id;
                try {
                    const task = await fetchData(`/api/task/${taskId}`);
                    document.getElementById('edit-task-id').value = task.id;
                    document.getElementById('edit-title').value = task.title;
                    document.getElementById('edit-description').value = task.description || '';
                    document.getElementById('edit-status').value = task.status;
                    document.getElementById('edit-priority').value = task.priority;
                    document.getElementById('edit-due-date').value = task.due_date || '';
                    showModal(editTaskModal);
                } catch (error) {
                    console.error('Error fetching task details:', error);
                }
            }
        });
    }

    // --- Form Submissions ---
    newTaskForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(newTaskForm);
        const data = Object.fromEntries(formData.entries());
        data.week_number = parseInt(data.week_number);
        data.status = data.status || 'todo';
        try {
            const newTask = await fetchData('/api/task', 'POST', data);
            
            // Re-fetch all tasks for the current week and re-render the lists to ensure consistency
            const tasks = await fetchData(`/api/week/${kanbanBoard.dataset.week}/tasks`);
            renderTasks(tasks); 
            
            hideModal(newTaskModal);
            newTaskForm.reset();
            
            const progress = await fetchData(`/api/week/${kanbanBoard.dataset.week}/progress`);
            document.getElementById('progress-text').textContent = `${progress.done} of ${progress.total} tasks completed (${progress.percentage}%)`;
        } catch (error) {
            console.error('Error creating task:', error);
        }
    });

    editTaskForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const taskId = document.getElementById('edit-task-id').value;
        const formData = new FormData(editTaskForm);
        const data = Object.fromEntries(formData.entries());
        try {
            const updatedTask = await fetchData(`/api/task/${taskId}`, 'PUT', data);
            const oldCard = document.getElementById(`task-${taskId}`);
            const newCard = createTaskCard(updatedTask);
            
            if (oldCard.dataset.status !== newCard.dataset.status) {
                const newStatusList = document.getElementById(`${newCard.dataset.status}-list`);
                newStatusList.appendChild(newCard);
                oldCard.remove();
            } else {
                oldCard.replaceWith(newCard);
            }
            updateTaskCounts();
            hideModal(editTaskModal);
            const progress = await fetchData(`/api/week/${kanbanBoard.dataset.week}/progress`);
            document.getElementById('progress-text').textContent = `${progress.done} of ${progress.total} tasks completed (${progress.percentage}%)`;
        } catch (error) {
            console.error('Error updating task:', error);
        }
    });

    document.getElementById('delete-task-btn')?.addEventListener('click', async () => {
        const taskId = document.getElementById('edit-task-id').value;
        if (confirm('Are you sure you want to delete this task?')) {
            try {
                await fetchData(`/api/task/${taskId}`, 'DELETE');
                document.getElementById(`task-${taskId}`).remove();
                updateTaskCounts();
                hideModal(editTaskModal);
                const progress = await fetchData(`/api/week/${kanbanBoard.dataset.week}/progress`);
                document.getElementById('progress-text').textContent = `${progress.done} of ${progress.total} tasks completed (${progress.percentage}%)`;
            } catch (error) {
                console.error('Error deleting task:', error);
            }
        }
    });

    newWeekForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(newWeekForm);
        const data = Object.fromEntries(formData.entries());
        data.week_number = parseInt(data.week_number);
        try {
            const newWeek = await fetchData('/api/week', 'POST', data);
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
            const updatedWeek = await fetchData(`/api/week/${weekNumber}`, 'PUT', data);
            window.location.reload();
        } catch (error) {
            console.error('Error updating week:', error);
        }
    });

    // --- Initial Data Load ---
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
    }
});