import Component from '@glint/environment-ember-loose/glimmer-component';

export default class FooterComponent extends Component {}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    Footer: typeof FooterComponent;
  }
}
