import Store from '@ember-data/store';
import ArrayProxy from '@ember/array';
import Transition from '@ember/routing/-private/transition';
import Route from '@ember/routing/route';
import RouterService from '@ember/routing/router-service';
import { inject as service } from '@ember/service';
// eslint-disable-next-line ember/use-ember-data-rfc-395-imports
import ModelRegistry from 'ember-data/types/registries/model';
import { hash } from 'rsvp';

import CableService from '@algonauti/ember-cable/services/cable';
import { Consumer, Subscription } from '@rails/actioncable';

import config from 'noutube/config/environment';
import JSONAPIPayload from 'noutube/lib/types/json-api-payload';
import ItemModel from 'noutube/models/item';
import SubscriptionModel from 'noutube/models/subscription';
import SessionService from 'noutube/services/session';

interface Model {
  items: ArrayProxy<ItemModel>;
  subscriptions: ArrayProxy<SubscriptionModel>;
}

type FeedCreateMessage = {
  action: 'create';
  payload: JSONAPIPayload;
};

type FeedUpdateMessage = {
  action: 'update';
  payload: JSONAPIPayload;
};

type FeedDestroyMessage = {
  action: 'destroy';
  id: string;
  type: keyof ModelRegistry;
};

type FeedMessage = FeedCreateMessage | FeedUpdateMessage | FeedDestroyMessage;

export default class FeedRoute extends Route {
  @service declare cable: CableService;
  @service declare router: RouterService;
  @service declare session: SessionService;
  @service declare store: Store;

  #consumer: Consumer | null = null;
  #feed: Subscription | null = null;
  #reconnecting = false;

  get cableAddress(): string {
    const base = `${config.backendOrigin.replace(/^http/, 'ws')}/cable/`;
    if (this.session.signedIn) {
      return `${base}?token=${this.session.token}`;
    } else {
      return base;
    }
  }

  async beforeModel(transition: Transition): Promise<void> {
    if (!this.session.signedIn && !this.session.down) {
      this.router.transitionTo('landing');
    }
  }

  model(): Promise<Model> {
    if (this.session.down) {
      return new Promise(() => {
        // load indefinitely
      });
    } else {
      // fetch all data for user
      return hash({
        items: this.store.findAll('item'),
        subscriptions: this.store.findAll('subscription')
      });
    }
  }

  activate(): void {
    if (this.session.down) {
      return;
    }

    this.#consumer = this.cable.createConsumer(this.cableAddress);

    this.#feed = this.#consumer.subscriptions.create('FeedChannel', {
      connected: () => {
        console.debug('[feed] connected');
        if (this.#reconnecting) {
          // fetch anything we missed
          this.reloadFromServer('item');
          this.reloadFromServer('subscription');
        }
        this.#reconnecting = false;
      },

      disconnected: () => {
        if (!this.#reconnecting) {
          console.debug('[feed] disconnected');
          this.#reconnecting = true;
        }
      },

      received: (data: FeedMessage) => {
        console.debug('[feed] message', data);
        switch (data.action) {
          case 'create':
          case 'update':
            this.store.pushPayload(data.payload);
            break;
          case 'destroy': {
            const record = this.store.peekRecord(data.type, data.id);
            if (record && !record.isDeleted) {
              record.deleteRecord();
            }
            break;
          }
        }
      }
    });
  }

  deactivate(): void {
    if (this.#consumer) {
      this.#consumer.disconnect();
      this.#consumer = null;
      if (this.#feed) {
        this.#feed.unsubscribe();
        this.#feed = null;
      }
      this.#reconnecting = false;
      console.debug('[feed] destroyed');
    }

    this.store.unloadAll('item');
    this.store.unloadAll('subscription');
  }

  async reloadFromServer(modelName: keyof ModelRegistry): Promise<void> {
    const before = this.store.peekAll(modelName);
    const after = await this.store.query(modelName, {});
    // manually remove anything removed on server
    before
      .filter((model) => !after.findBy('id', model.id))
      .forEach((model) => model.deleteRecord());
  }
}
