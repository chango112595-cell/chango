import { bus } from "../core/eventBus.js";
import { flag } from "../core/once.js";

if (flag("monitor_tasks")) {
  // State
  let tasks = [];
  let filteredTasks = [];
  let selectedPriority = "all";
  let searchQuery = "";
  let sortBy = "priority"; // priority, status, percent
  let sseConnection = null;
  let panel = null;
  let taskListEl = null;
  let statsEl = null;
  
  // Status emoji map for display
  const statusMap = {
    "⏸": "Paused",
    "🟡": "In Progress",
    "🟢": "Active",
    "✅": "Complete",
    "🟣": "Testing"
  };
  
  // Find the host element for injection
  function findHost() {
    return document.querySelector("[data-chango-debug]") ||
           document.querySelector(".debug-monitor") ||
           document.getElementById("debug");
  }
  
  // Create the Tasks button
  function mkBtn() {
    const b = document.createElement("button");
    b.textContent = "Tasks";
    Object.assign(b.style, {
      all: "unset",
      cursor: "pointer",
      padding: "6px 10px",
      border: "1px solid rgba(0,255,255,.35)",
      borderRadius: "6px",
      fontFamily: "ui-monospace",
      fontSize: "12px",
      color: "#00ffff"
    });
    return b;
  }
  
  // Get or create the button bar
  function mkBar() {
    const d = document.createElement("div");
    d.className = "chango-tabs-inject";
    Object.assign(d.style, {
      display: "flex",
      gap: "8px",
      padding: "6px 8px"
    });
    return d;
  }
  
  // Create the main panel
  function mkPanel() {
    const div = document.createElement("div");
    div.className = "chango-tasks-panel";
    Object.assign(div.style, {
      margin: "8px",
      padding: "8px",
      height: "400px",
      overflow: "hidden",
      background: "rgba(0,0,0,.35)",
      border: "1px solid rgba(0,255,255,.25)",
      borderRadius: "6px",
      font: "12px/1.4 ui-monospace",
      color: "#00ffff",
      display: "flex",
      flexDirection: "column"
    });
    
    // Controls section
    const controls = document.createElement("div");
    Object.assign(controls.style, {
      display: "flex",
      gap: "10px",
      marginBottom: "10px",
      flexWrap: "wrap"
    });
    
    // Priority filter
    const prioritySelect = document.createElement("select");
    Object.assign(prioritySelect.style, {
      background: "rgba(0, 255, 255, 0.1)",
      border: "1px solid rgba(0, 255, 255, 0.3)",
      color: "#00ffff",
      padding: "5px",
      borderRadius: "4px",
      fontSize: "11px"
    });
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
    Object.assign(sortSelect.style, prioritySelect.style);
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
    Object.assign(searchInput.style, {
      background: "rgba(0, 255, 255, 0.1)",
      border: "1px solid rgba(0, 255, 255, 0.3)",
      color: "#00ffff",
      padding: "5px",
      borderRadius: "4px",
      flex: "1",
      minWidth: "150px",
      fontSize: "11px"
    });
    searchInput.oninput = (e) => {
      searchQuery = e.target.value;
      applyFilters();
      updateDisplay();
    };
    
    controls.appendChild(prioritySelect);
    controls.appendChild(sortSelect);
    controls.appendChild(searchInput);
    
    // Stats bar
    statsEl = document.createElement("div");
    Object.assign(statsEl.style, {
      display: "flex",
      gap: "15px",
      marginBottom: "10px",
      color: "rgba(0, 255, 255, 0.8)",
      fontSize: "11px"
    });
    
    // Task list
    taskListEl = document.createElement("div");
    Object.assign(taskListEl.style, {
      flex: "1",
      overflowY: "auto",
      border: "1px solid rgba(0, 255, 255, 0.2)",
      borderRadius: "4px",
      padding: "5px"
    });
    
    div.appendChild(controls);
    div.appendChild(statsEl);
    div.appendChild(taskListEl);
    
    div.style.display = "none"; // Initially hidden
    
    // Initial content
    taskListEl.innerHTML = `<div style="color: rgba(0, 255, 255, 0.5); text-align: center; padding: 20px;">Loading tasks...</div>`;
    
    return div;
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
          console.error("[monitor_tasks] SSE parse error:", e);
        }
      };
      
      sseConnection.onerror = (error) => {
        console.error("[monitor_tasks] SSE error:", error);
        // Reconnect after 5 seconds
        setTimeout(connectSSE, 5000);
      };
    } catch (e) {
      console.error("[monitor_tasks] Failed to connect SSE:", e);
      // Fallback to polling
      fetchTasks();
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
  
  // Fetch tasks manually
  function fetchTasks() {
    fetch("/api/tasks/status.json")
      .then(res => res.json())
      .then(data => {
        tasks = data.tasks || [];
        applyFilters();
        updateDisplay();
      })
      .catch(err => {
        console.error("[monitor_tasks] Failed to fetch tasks:", err);
        if (taskListEl) {
          taskListEl.innerHTML = `<div style="color: rgba(255, 100, 100, 0.8); text-align: center; padding: 20px;">Failed to load tasks</div>`;
        }
      });
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
  
  // Update stats display
  function updateStats() {
    if (!statsEl) return;
    
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
  function updateTaskList() {
    if (!taskListEl) return;
    
    if (filteredTasks.length === 0) {
      taskListEl.innerHTML = `
        <div style="color: rgba(0, 255, 255, 0.5); text-align: center; padding: 20px;">
          No tasks found
        </div>
      `;
      return;
    }
    
    taskListEl.innerHTML = filteredTasks.map(task => `
      <div style="
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
    updateStats();
    updateTaskList();
  }
  
  // Initialize
  function init() {
    const host = findHost();
    if (!host) return;
    
    // Get or create button bar
    let bar = host.querySelector(".chango-tabs-inject");
    if (!bar) {
      bar = mkBar();
      host.appendChild(bar);
    }
    
    // Create button and panel
    const btn = mkBtn();
    panel = mkPanel();
    host.appendChild(panel);
    
    // Toggle panel visibility on button click
    btn.addEventListener("click", () => {
      const isVisible = panel.style.display !== "none";
      panel.style.display = isVisible ? "none" : "block";
      
      // If showing, fetch latest tasks
      if (!isVisible) {
        fetchTasks();
        if (!sseConnection || sseConnection.readyState === EventSource.CLOSED) {
          connectSSE();
        }
      }
    });
    
    // Add button to bar
    bar.appendChild(btn);
    
    // Listen for task-related events
    bus.on("tasks:update", (data) => {
      handleSSEMessage(data);
    });
    
    bus.on("tasks:refresh", () => {
      fetchTasks();
    });
    
    // Initial data fetch
    fetchTasks();
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
    VERSION: "2.0.0",
    getTasks: () => tasks,
    getFiltered: () => filteredTasks,
    refresh: () => fetchTasks(),
    showPanel: () => { if (panel) panel.style.display = "block"; },
    hidePanel: () => { if (panel) panel.style.display = "none"; }
  };
}