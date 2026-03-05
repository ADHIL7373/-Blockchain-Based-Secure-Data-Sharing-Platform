/**
 * ============================================================================
 * WEBSOCKET DIAGNOSTICS UTILITY
 * ============================================================================
 * 
 * This utility helps diagnose WebSocket connection issues
 * Run these diagnostics when experiencing connection problems
 */

/**
 * Diagnose socket service state
 */
export function diagnosisSocketService(socketService) {
  if (!socketService) {
    return {
      error: 'Socket service not initialized',
    };
  }

  const metrics = socketService.getMetrics();
  const state = socketService.getState();

  return {
    state,
    isConnected: socketService.isConnected(),
    metrics,
    diagnosis: generateDiagnosis(metrics, state),
  };
}

/**
 * Generate diagnosis from metrics and state
 */
function generateDiagnosis(metrics, state) {
  const issues = [];
  const suggestions = [];

  // Analyze state
  if (state === 'FAILED') {
    issues.push('❌ Connection in FAILED state');
    suggestions.push('Check server is running on correct port (8081)');
    suggestions.push('Verify firewall allows WebSocket connections');
    suggestions.push('Check browser console for specific error');
  }

  if (state === 'RECONNECTING') {
    issues.push('⚠️  Currently reconnecting');
    suggestions.push('Check server health: http://localhost:8081/health');
    suggestions.push('Wait for automatic reconnection');
  }

  if (state === 'CONNECTING') {
    issues.push('⚠️  Connection attempt in progress');
    suggestions.push('Wait a moment for connection to complete');
  }

  // Analyze metrics
  if (metrics.failedConnections > metrics.successfulConnections) {
    issues.push('❌ More failed connections than successful ones');
    suggestions.push('Check server logs for errors');
    suggestions.push('Verify signaling server is running');
  }

  if (metrics.connectionAttempts > 10 && !metrics.isConnected) {
    issues.push('❌ Too many connection attempts without success');
    suggestions.push('Check browser socket limits: chrome://net-internals/ → Sockets');
    suggestions.push('Close other WebSocket connections');
    suggestions.push('Restart browser');
  }

  if (metrics.messagesReceived === 0 && metrics.isConnected) {
    issues.push('⚠️  Connected but no messages received');
    suggestions.push('Server may not be sending heartbeat');
    suggestions.push('Check if other peers are connected');
  }

  return {
    issues: issues.length > 0 ? issues : ['✅ No known issues'],
    suggestions: suggestions.length > 0 ? suggestions : ['Connection appears healthy'],
  };
}

/**
 * Check browser socket limits
 */
export function checkBrowserSocketLimits() {
  const maxSockets = navigator.maxTouchPoints ? 6 : 10; // Rough estimation

  return {
    estimatedMaxWebSocketsPerHost: maxSockets,
    status: maxSockets >= 2 ? '✅ Should support at least 2 connections' : '❌ Very limited',
    warning: 'Use chrome://net-internals/ → Sockets to see actual limits',
  };
}

/**
 * Get comprehensive diagnostics
 */
export async function getComprehensiveDiagnostics(socketService, signalingServerUrl) {
  const baseUrl = signalingServerUrl
    .replace('ws://', 'http://')
    .replace('wss://', 'https://');

  const diagnostics = {
    timestamp: new Date().toISOString(),
    socketService: diagnosisSocketService(socketService),
    browser: {
      userAgent: navigator.userAgent,
      socketLimits: checkBrowserSocketLimits(),
    },
    server: {},
  };

  // Check server health
  try {
    const healthResponse = await fetch(`${baseUrl}/health`);
    diagnostics.server.health = await healthResponse.json();
    diagnostics.server.healthStatus = healthResponse.ok ? '✅ Healthy' : '❌ Unhealthy';
  } catch (err) {
    diagnostics.server.healthError = err.message;
    diagnostics.server.healthStatus = '❌ Unreachable';
  }

  // Check metrics
  try {
    const metricsResponse = await fetch(`${baseUrl}/metrics`);
    diagnostics.server.metrics = await metricsResponse.json();
  } catch (err) {
    diagnostics.server.metricsError = err.message;
  }

  // Check peers
  try {
    const peersResponse = await fetch(`${baseUrl}/peers`);
    diagnostics.server.peers = await peersResponse.json();
  } catch (err) {
    diagnostics.server.peersError = err.message;
  }

  return diagnostics;
}

/**
 * Format diagnostics for display
 */
export function formatDiagnosticsForConsole(diagnostics) {
  const output = [];

  output.push('\n=================================================================');
  output.push('WEBSOCKET DIAGNOSTICS REPORT');
  output.push('=================================================================\n');

  output.push(`⏰ Timestamp: ${diagnostics.timestamp}\n`);

  // Socket Service
  output.push('📊 SOCKET SERVICE STATUS');
  output.push(`  State: ${diagnostics.socketService.state}`);
  output.push(`  Connected: ${diagnostics.socketService.isConnected ? '✅ Yes' : '❌ No'}`);
  if (diagnostics.socketService.metrics) {
    const m = diagnostics.socketService.metrics;
    output.push(`  Connection Attempts: ${m.connectionAttempts}`);
    output.push(`  Successful: ${m.successfulConnections}`);
    output.push(`  Failed: ${m.failedConnections}`);
    output.push(`  Messages Sent: ${m.messagesSent}`);
    output.push(`  Messages Received: ${m.messagesReceived}`);
  }
  output.push('');

  // Diagnosis
  if (diagnostics.socketService.diagnosis) {
    const d = diagnostics.socketService.diagnosis;
    output.push('⚙️  DIAGNOSIS');
    d.issues.forEach((issue) => output.push(`  ${issue}`));
    output.push('');
    output.push('💡 SUGGESTIONS');
    d.suggestions.forEach((suggestion) => output.push(`  • ${suggestion}`));
    output.push('');
  }

  // Browser
  output.push('🌐 BROWSER INFO');
  output.push(`  Socket Limits: ${diagnostics.browser.socketLimits.estimatedMaxWebSocketsPerHost} per host`);
  output.push(`  Status: ${diagnostics.browser.socketLimits.status}`);
  output.push('');

  // Server
  output.push('🖥️  SERVER STATUS');
  if (diagnostics.server.healthStatus) {
    output.push(`  Health: ${diagnostics.server.healthStatus}`);
    if (diagnostics.server.health) {
      output.push(`  Active Peers: ${diagnostics.server.health.activePeers}`);
    }
  }
  if (diagnostics.server.peers) {
    output.push(`  Connected Peers: ${diagnostics.server.peers.count}`);
  }
  output.push('');

  output.push('=================================================================\n');

  return output.join('\n');
}

/**
 * Export diagnostics to JSON
 */
export function exportDiagnosticsAsJSON(diagnostics) {
  return JSON.stringify(diagnostics, null, 2);
}

/**
 * Log diagnostics to console
 */
export async function logComprehensiveDiagnostics(socketService, signalingServerUrl) {
  try {
    const diagnostics = await getComprehensiveDiagnostics(
      socketService,
      signalingServerUrl
    );
    console.log(formatDiagnosticsForConsole(diagnostics));
    console.log('📋 Full diagnostic data (use for bug reports):');
    console.log(exportDiagnosticsAsJSON(diagnostics));
    return diagnostics;
  } catch (err) {
    console.error('Failed to generate diagnostics:', err);
  }
}
