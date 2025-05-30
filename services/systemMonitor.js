const si = require('systeminformation');
async function getSystemStats() {
  try {
    const [cpuData, memData] = await Promise.all([
      si.currentLoad(),
      si.mem()
    ]);
    const cpuUsage = cpuData.currentLoad || cpuData.avg || 0;
    const formatMemory = (bytes) => {
      if (bytes >= 1073741824) {
        return (bytes / 1073741824).toFixed(2) + " GB";
      } else {
        return (bytes / 1048576).toFixed(2) + " MB";
      }
    };
    return {
      cpu: {
        usage: Math.round(cpuUsage),
        cores: cpuData.cpus ? cpuData.cpus.length : 0
      },
      memory: {
        total: formatMemory(memData.total),
        used: formatMemory(memData.active),
        free: formatMemory(memData.available),
        usagePercent: Math.round((memData.active / memData.total) * 100)
      },
      platform: process.platform,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Error getting system stats:', error);
    return {
      cpu: { usage: 0, cores: 0 },
      memory: { total: "0 GB", used: "0 GB", free: "0 GB", usagePercent: 0 },
      platform: process.platform,
      timestamp: Date.now()
    };
  }
}
module.exports = { getSystemStats };