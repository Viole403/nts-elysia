import { Elysia, Context } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { cors } from '@elysiajs/cors';
import { jwt } from '@elysiajs/jwt';
import { bearer } from '@elysiajs/bearer';
import { oauth2Plugin } from '../src/plugins/oauth2.plugin';
import { authModule } from '../src/modules/auth';
import { articlesModule } from '../src/modules/articles';
import { commentsModule } from '../src/modules/comments';
import { reactionsModule } from '../src/modules/reactions';
import { paymentsModule } from '../src/modules/payments';
import { cronModule } from '../src/modules/cron';
import { userModule } from '../src/modules/users';
import { notificationsModule } from '../src/modules/notifications';
import { groupModule } from '../src/modules/groups';

import { jobModule } from '../src/modules/jobs';
import { courseModule } from '../src/modules/courses';
import { eventModule } from '../src/modules/events';
import { shopModule } from '../src/modules/shop';
import { subscriptionModule } from '../src/modules/subscriptions';
import { cardModule } from '../src/modules/cards';
import { paymentAccountModule } from '../src/modules/accounts';
import { beneficiaryModule } from '../src/modules/beneficiaries';
import { payoutModule } from '../src/modules/payouts';
import { rbac } from '../src/plugins/rbac';
import { UserRole } from '@prisma/client';

const app = new Elysia();

app.use(cors());
app.use(swagger({
  documentation: {
    info: {
      title: 'NTS Elysia API',
      description: 'API documentation for the NTS Elysia application',
      version: '1.0.0',
    },
  },
}));
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

app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);

app.get('/', () => ({
  message: 'Welcome to the API!',
}));

console.log(
  `
    App is running at http://${app.server?.hostname}:${app.server?.port}
  `
);

export default app;
