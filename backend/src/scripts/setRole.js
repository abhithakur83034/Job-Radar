// Grant or revoke admin (needed for manual job-source refresh/status endpoints).
// Usage: npm run set-role -- <username | mobile | email> [admin|user]
import mongoose from 'mongoose';
import { connectDatabase } from '../config/db.js';
import { User } from '../models/User.js';
import { identifierQuery } from '../utils/identity.js';

const [identifier, role = 'admin'] = process.argv.slice(2);
if (!identifier || !['admin', 'user'].includes(role)) {
  console.error('Usage: npm run set-role -- <username | mobile | email> [admin|user]');
  process.exit(1);
}

await connectDatabase();
const user = await User.findOneAndUpdate(identifierQuery(identifier), { role }, { returnDocument: 'after' });
console.log(user ? `${user.username || user.email} is now "${user.role}"` : `No user found for "${identifier}"`);
await mongoose.connection.close();
process.exit(user ? 0 : 1);
