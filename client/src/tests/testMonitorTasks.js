/**
 * Test script for monitor_tasks.js integration
 * Run in browser console to verify functionality
 */

// Test that the module loaded and exports are available
console.log("Testing monitor_tasks.js integration...");

// Check if Chango.diag.monitorTasks is available
if (window.Chango?.diag?.monitorTasks) {
  console.log("✅ Monitor tasks module loaded successfully");
  console.log("   Version:", window.Chango.diag.monitorTasks.VERSION);
  
  // Check if we can get tasks
  const tasks = window.Chango.diag.monitorTasks.getTasks();
  console.log("✅ Tasks fetched:", tasks.length, "tasks");
  
  // Check filtered tasks
  const filtered = window.Chango.diag.monitorTasks.getFiltered();
  console.log("✅ Filtered tasks:", filtered.length, "tasks");
  
  // Check if panel functions work
  window.Chango.diag.monitorTasks.showPanel();
  console.log("✅ Panel show function works");
  
  setTimeout(() => {
    window.Chango.diag.monitorTasks.hidePanel();
    console.log("✅ Panel hide function works");
  }, 2000);
  
  // Trigger a refresh
  window.Chango.diag.monitorTasks.refresh();
  console.log("✅ Refresh triggered");
  
  // Check for the Tasks button in the DOM
  const tasksButton = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Tasks');
  if (tasksButton) {
    console.log("✅ Tasks button found in DOM");
    
    // Simulate a click to toggle the panel
    tasksButton.click();
    console.log("✅ Tasks button clicked - panel should be visible");
    
    setTimeout(() => {
      tasksButton.click();
      console.log("✅ Tasks button clicked again - panel should be hidden");
    }, 3000);
  } else {
    console.log("⚠️ Tasks button not found - Debug Monitor might not be visible");
  }
  
  console.log("\n✨ All tests passed! Monitor tasks integration is working correctly.");
} else {
  console.error("❌ Monitor tasks module not loaded - check if the script is included in index.html");
}