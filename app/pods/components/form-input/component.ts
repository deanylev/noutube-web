import { action } from '@ember/object';
import Component from '@glint/environment-ember-loose/glimmer-component';

interface Signature {
  Args: {
    disabled?: boolean;
    label: string;
    onChange: (value: string) => void;
    type?: string;
    value: string;
  } & (
    | {
        attribute: string;
        errors: Record<string, string>;
      }
    // eslint-disable-next-line @typescript-eslint/ban-types
    | {}
  );
}

export default class FormInputComponent extends Component<Signature> {
  get error(): string | undefined {
    if ('errors' in this.args) {
      return this.args.errors[this.args.attribute];
    } else {
      return;
    }
  }

  get type(): string {
    return this.args.type ?? 'text';
  }

  @action
  handleInput(event: InputEvent): void {
    if (event.target instanceof HTMLInputElement) {
      this.args.onChange(event.target.value);
    }
  }
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    FormInput: typeof FormInputComponent;
  }
}
