const fs = require('fs').promises;
const path = require('path');
const { format } = require('date-fns');

class Logger {
    constructor() {
        this.logDir = path.join(__dirname, '../logs');
        this.init();
    }

    async init() {
        try {
            await fs.mkdir(this.logDir, { recursive: true });
        } catch (error) {
            console.error('Ошибка создания директории логов:', error);
        }
    }

    async log(action, user, details = {}, level = 'info') {
        const timestamp = new Date();
        const logEntry = {
            id: Date.now(),
            timestamp,
            level,
            action,
            user: user ? {
                id: user.id,
                username: user.username,
                role: user.Role ? user.Role.name : 'unknown',
                avatar: user.avatar
            } : null,
            details,
            ip: details.ip || 'unknown'
        };

        const logFile = path.join(this.logDir, `system-${format(timestamp, 'yyyy-MM-dd')}.json`);
        
        try {
            let logs = [];
            try {
                const data = await fs.readFile(logFile, 'utf8');
                logs = JSON.parse(data);
            } catch (e) {}
            
            logs.push(logEntry);
            await fs.writeFile(logFile, JSON.stringify(logs, null, 2), 'utf8');
        } catch (error) {
            console.error('Ошибка записи лога:', error);
        }

        const levelColors = {
            info: '\x1b[36m', 
            warning: '\x1b[33m',
            error: '\x1b[31m',
            critical: '\x1b[41m\x1b[37m'
        };
        
        const resetColor = '\x1b[0m';
        console.log(
            `${levelColors[level]}[${format(timestamp, 'HH:mm:ss')}] ${action}${resetColor}`,
            user ? `- ${user.username} (${user.Role ? user.Role.name : 'unknown'})` : ''
        );

        return logEntry;
    }

    async getLogs(filters = {}) {
        try {
            const { dateFrom, dateTo, type, level, showAdminOnly, showModeratorOnly } = filters;
            let allLogs = [];

            for (let i = 0; i < 7; i++) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const logFile = path.join(this.logDir, `system-${format(date, 'yyyy-MM-dd')}.json`);
                
                try {
                    const data = await fs.readFile(logFile, 'utf8');
                    const logs = JSON.parse(data);
                    allLogs = [...allLogs, ...logs];
                } catch (e) {}
            }

            let filteredLogs = allLogs;

            if (dateFrom) {
                const fromDate = new Date(dateFrom);
                filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= fromDate);
            }

            if (dateTo) {
                const toDate = new Date(dateTo);
                toDate.setHours(23, 59, 59, 999);
                filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= toDate);
            }

            if (level && level !== 'all') {
                filteredLogs = filteredLogs.filter(log => log.level === level);
            }

            if (type && type !== 'all') {
                filteredLogs = filteredLogs.filter(log => 
                    log.action.toLowerCase().includes(type.toLowerCase())
                );
            }

            if (showAdminOnly) {
                filteredLogs = filteredLogs.filter(log => 
                    log.user && log.user.role === 'admin'
                );
            }

            if (showModeratorOnly) {
                filteredLogs = filteredLogs.filter(log => 
                    log.user && log.user.role === 'moderator'
                );
            }

            return filteredLogs.sort((a, b) => 
                new Date(b.timestamp) - new Date(a.timestamp)
            ).slice(0, 100);
        } catch (error) {
            console.error('Ошибка чтения логов:', error);
            return [];
        }
    }

    async clearLogs() {
        try {
            const files = await fs.readdir(this.logDir);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    await fs.unlink(path.join(this.logDir, file));
                }
            }
            return true;
        } catch (error) {
            console.error('Ошибка очистки логов:', error);
            return false;
        }
    }
}

module.exports = new Logger();