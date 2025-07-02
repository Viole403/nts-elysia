import { Elysia, Context } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { cors } from '@elysiajs/cors';
import { jwt } from '@elysiajs/jwt';
import { bearer } from '@elysiajs/bearer';
import { oauth2Plugin } from './plugins/oauth2';
import { authModule } from './modules/auth';
import { articlesModule } from './modules/articles';
import { commentsModule } from './modules/comments';
import { reactionsModule } from './modules/reactions';
import { paymentsModule } from './modules/payments';
import { cronModule } from './modules/cron';
import { userModule } from './modules/users';
import { notificationsModule } from './modules/notifications';
import { groupModule } from './modules/groups';

import { jobModule } from './modules/jobs';
import { courseModule } from './modules/courses';
import { eventModule } from './modules/events';
import { shopModule } from './modules/shop';
import { subscriptionModule } from './modules/subscriptions';
import { cardModule } from './modules/cards';
import { paymentAccountModule } from './modules/accounts';
import { beneficiaryModule } from './modules/beneficiaries';
import { payoutModule } from './modules/payouts';
import { rbac } from './plugins/rbac';
import { UserRole } from '@prisma/client';

const app = new Elysia();

app.use(cors());
app.use(swagger());
app.use(jwt({
  name: 'jwt',
  secret: process.env.JWT_SECRET || 'supersecret',
}));
app.use(bearer());
app.use(oauth2Plugin);

app.use(authModule);
app.use(userModule);
app.use(articlesModule);
app.use(groupModule);

app.use(jobModule);
app.use(courseModule);
app.use(eventModule);
app.use(shopModule);
app.use(commentsModule);
app.use(reactionsModule);
app.use(notificationsModule);
app.use(paymentsModule);
app.use(subscriptionModule);
app.use(cardModule);
app.use(paymentAccountModule);
app.use(beneficiaryModule);
app.use(payoutModule);
app.use(cronModule);

// Example protected admin route


app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);

console.log(
  `
    App is running at http://${app.server?.hostname}:${app.server?.port}
  `
);
export default app;
