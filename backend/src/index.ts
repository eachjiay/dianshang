import app from './app.js';
import { initDB } from './db/database.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        await initDB();
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
