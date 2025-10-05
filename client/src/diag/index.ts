export { startDiagRunner, stopDiagRunner } from './runner';
export { attachDiagNotifier } from './notifier';
// Import built-in checks on boot
import './checks/sttPipeline';
import './checks/ttsStuck';
import './checks/micPerm';
import './checks/perfBudget';
import './checks/conversationEngine';