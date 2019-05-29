import { get, set } from '@ember/object';
import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default Route.extend({
  session: service(),
  theme: service(),

  async beforeModel(transition) {
    let theme = get(this, 'theme');
    theme.applyTheme();

    try {
      let store = get(this, 'store');
      let me = await store.queryRecord('user', { me: true });
      set(this, 'session.me', me);
    } catch (e) {
      // not logged in, swallow
    }
  }
});
