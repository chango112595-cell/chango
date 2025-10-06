/**
 * monitor_tasks.js - Debug Monitor Tasks Tab
 * Live task tracking with SSE updates, filters, sorting, and search
 */

(function() {
  const MODULE_ID = "monitor_tasks";
  const VERSION = "1.0.0";
  
  // State
  let tasks = [];
  let filteredTasks = [];
  let selectedPriority = "all";
  let searchQuery = "";
  let sortBy = "priority"; // priority, status, percent
  let sseConnection = null;
  
  // Status emoji map for display
  const statusMap = {
    "⏸": "Paused",
    "🟡": "In Progress",
    "🟢": "Active",
    "✅": "Complete",
    "🟣": "Testing"
  };
  
  // Initialize module
  function init() {
    console.log(`[${MODULE_ID}] v${VERSION} initializing`);
    
    // Register tab with monitor if available
    if (window.Chango?.diag?.registerTab) {
      window.Chango.diag.registerTab({
        id: "tasks",
        label: "Tasks",
        icon: "📋",
        render: renderTab,
        onActivate: onTabActivate,
        onDeactivate: onTabDeactivate
      });
    }
    
    // Start SSE connection
    connectSSE();
  }
  
  // Connect to SSE stream
  function connectSSE() {
    if (sseConnection) {
      sseConnection.close();
    }
    
    try {
      sseConnection = new EventSource("/api/tasks/stream");
      
      sseConnection.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleSSEMessage(data);
        } catch (e) {
          console.error(`[${MODULE_ID}] SSE parse error:`, e);
        }
      };
      
      sseConnection.onerror = (error) => {
        console.error(`[${MODULE_ID}] SSE error:`, error);
        // Reconnect after 5 seconds
        setTimeout(connectSSE, 5000);
      };
    } catch (e) {
      console.error(`[${MODULE_ID}] Failed to connect SSE:`, e);
    }
  }
  
  // Handle SSE messages
  function handleSSEMessage(data) {
    if (data.type === "init") {
      tasks = data.tasks || [];
      applyFilters();
      updateDisplay();
    } else if (data.type === "update") {
      const task = tasks.find(t => t.id === data.id);
      if (task) {
        Object.assign(task, data.updates);
        applyFilters();
        updateDisplay();
      }
    }
  }
  
  // Apply filters and sorting
  function applyFilters() {
    // Start with all tasks
    filteredTasks = [...tasks];
    
    // Apply priority filter
    if (selectedPriority !== "all") {
      const priority = parseInt(selectedPriority);
      filteredTasks = filteredTasks.filter(t => t.priority === priority);
    }
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredTasks = filteredTasks.filter(t => 
        t.title.toLowerCase().includes(query) ||
        t.desc.toLowerCase().includes(query) ||
        t.layer.toLowerCase().includes(query) ||
        t.id.toLowerCase().includes(query)
      );
    }
    
    // Apply sorting
    filteredTasks.sort((a, b) => {
      switch(sortBy) {
        case "priority":
          return a.priority - b.priority || (b.weight || 1) - (a.weight || 1);
        case "status":
          const statusOrder = ["⏸", "🟡", "🟢", "✅", "🟣"];
          return statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
        case "percent":
          return b.percent - a.percent;
        default:
          return 0;
      }
    });
  }
  
  // Render the tab content
  function renderTab() {
    const container = document.createElement("div");
    container.className = "monitor-tasks-container";
    container.style.cssText = `
      height: 100%;
      display: flex;
      flex-direction: column;
      padding: 10px;
      overflow: hidden;
    `;
    
    // Controls
    const controls = document.createElement("div");
    controls.className = "tasks-controls";
    controls.style.cssText = `
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
      flex-wrap: wrap;
    `;
    
    // Priority filter
    const prioritySelect = document.createElement("select");
    prioritySelect.style.cssText = `
      background: rgba(0, 255, 255, 0.1);
      border: 1px solid rgba(0, 255, 255, 0.3);
      color: #00ffff;
      padding: 5px;
      border-radius: 4px;
    `;
    prioritySelect.innerHTML = `
      <option value="all">All Priorities</option>
      <option value="1">P1 - Critical</option>
      <option value="2">P2 - High</option>
      <option value="3">P3 - Medium</option>
      <option value="4">P4 - Low</option>
      <option value="5">P5 - Minor</option>
      <option value="6">P6 - Minimal</option>
    `;
    prioritySelect.value = selectedPriority;
    prioritySelect.onchange = (e) => {
      selectedPriority = e.target.value;
      applyFilters();
      updateDisplay();
    };
    
    // Sort selector
    const sortSelect = document.createElement("select");
    sortSelect.style.cssText = prioritySelect.style.cssText;
    sortSelect.innerHTML = `
      <option value="priority">Sort by Priority</option>
      <option value="status">Sort by Status</option>
      <option value="percent">Sort by Progress</option>
    `;
    sortSelect.value = sortBy;
    sortSelect.onchange = (e) => {
      sortBy = e.target.value;
      applyFilters();
      updateDisplay();
    };
    
    // Search input
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Quick search...";
    searchInput.value = searchQuery;
    searchInput.style.cssText = `
      background: rgba(0, 255, 255, 0.1);
      border: 1px solid rgba(0, 255, 255, 0.3);
      color: #00ffff;
      padding: 5px;
      border-radius: 4px;
      flex: 1;
      min-width: 150px;
    `;
    searchInput.oninput = (e) => {
      searchQuery = e.target.value;
      applyFilters();
      updateDisplay();
    };
    
    controls.appendChild(prioritySelect);
    controls.appendChild(sortSelect);
    controls.appendChild(searchInput);
    
    // Stats bar
    const stats = document.createElement("div");
    stats.className = "tasks-stats";
    stats.style.cssText = `
      display: flex;
      gap: 15px;
      margin-bottom: 10px;
      color: rgba(0, 255, 255, 0.8);
      font-size: 11px;
    `;
    
    // Task list
    const taskList = document.createElement("div");
    taskList.className = "tasks-list";
    taskList.id = "monitor-tasks-list";
    taskList.style.cssText = `
      flex: 1;
      overflow-y: auto;
      border: 1px solid rgba(0, 255, 255, 0.2);
      border-radius: 4px;
      padding: 5px;
    `;
    
    container.appendChild(controls);
    container.appendChild(stats);
    container.appendChild(taskList);
    
    // Update stats
    updateStats(stats);
    
    // Populate task list
    updateTaskList(taskList);
    
    return container;
  }
  
  // Update stats display
  function updateStats(statsEl) {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === "✅").length;
    const active = tasks.filter(t => t.status === "🟢").length;
    const paused = tasks.filter(t => t.status === "⏸").length;
    
    // Calculate weighted progress
    const priorities = {};
    for (let i = 1; i <= 6; i++) {
      const pTasks = tasks.filter(t => t.priority === i);
      if (pTasks.length > 0) {
        const totalWeight = pTasks.reduce((sum, t) => sum + (t.weight || 1), 0);
        const weightedProgress = pTasks.reduce((sum, t) => 
          sum + ((t.weight || 1) * (t.percent / 100)), 0);
        priorities[`P${i}`] = Math.round((weightedProgress / totalWeight) * 100);
      }
    }
    
    statsEl.innerHTML = `
      <span>Total: ${total}</span>
      <span style="color: #00ff00;">✅ Complete: ${completed}</span>
      <span style="color: #00ffaa;">🟢 Active: ${active}</span>
      <span style="color: #ffff00;">⏸ Paused: ${paused}</span>
      ${Object.entries(priorities).map(([p, v]) => 
        `<span>${p}: ${v}%</span>`
      ).join("")}
    `;
  }
  
  // Update task list display
  function updateTaskList(listEl) {
    if (filteredTasks.length === 0) {
      listEl.innerHTML = `
        <div style="color: rgba(0, 255, 255, 0.5); text-align: center; padding: 20px;">
          No tasks found
        </div>
      `;
      return;
    }
    
    listEl.innerHTML = filteredTasks.map(task => `
      <div class="task-item" style="
        margin-bottom: 8px;
        padding: 8px;
        border: 1px solid rgba(0, 255, 255, 0.2);
        border-radius: 4px;
        background: rgba(0, 10, 20, 0.5);
      ">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
          <span style="font-size: 16px;">${task.status}</span>
          <span style="color: #00ffff; font-weight: bold;">P${task.priority}</span>
          <span style="flex: 1; color: #ffffff;">${task.title}</span>
          <span style="color: rgba(0, 255, 255, 0.8);">${task.percent}%</span>
        </div>
        <div style="color: rgba(255, 255, 255, 0.6); font-size: 11px; margin-bottom: 5px;">
          ${task.desc}
        </div>
        <div style="display: flex; gap: 10px; font-size: 10px; color: rgba(0, 255, 255, 0.6);">
          <span>${task.layer}</span>
          <span>Weight: ${task.weight || 1}</span>
          ${task.files?.length ? `<span>Files: ${task.files.length}</span>` : ""}
          ${task.deps?.length ? `<span>Deps: ${task.deps.length}</span>` : ""}
        </div>
        <div style="
          margin-top: 5px;
          height: 4px;
          background: rgba(0, 255, 255, 0.1);
          border-radius: 2px;
          overflow: hidden;
        ">
          <div style="
            width: ${task.percent}%;
            height: 100%;
            background: ${task.status === "✅" ? "#00ff00" : 
                       task.status === "🟢" ? "#00ffaa" :
                       task.status === "🟡" ? "#ffff00" : 
                       "rgba(0, 255, 255, 0.5)"};
            transition: width 0.3s ease;
          "></div>
        </div>
      </div>
    `).join("");
  }
  
  // Update display
  function updateDisplay() {
    const listEl = document.getElementById("monitor-tasks-list");
    const statsEl = document.querySelector(".tasks-stats");
    
    if (listEl) updateTaskList(listEl);
    if (statsEl) updateStats(statsEl);
  }
  
  // Tab activated
  function onTabActivate() {
    // Fetch latest tasks
    fetch("/api/tasks/status.json")
      .then(res => res.json())
      .then(data => {
        tasks = data.tasks || [];
        applyFilters();
        updateDisplay();
      })
      .catch(err => console.error(`[${MODULE_ID}] Failed to fetch tasks:`, err));
  }
  
  // Tab deactivated
  function onTabDeactivate() {
    // Nothing special needed
  }
  
  // Auto-initialize
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  
  // Export for debugging
  window.Chango = window.Chango || {};
  window.Chango.diag = window.Chango.diag || {};
  window.Chango.diag.monitorTasks = {
    VERSION,
    getTasks: () => tasks,
    getFiltered: () => filteredTasks,
    refresh: () => onTabActivate()
  };
})();