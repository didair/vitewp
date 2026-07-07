export type WpElement = string | number | boolean | null | undefined | WpElement[];

export type WpComponent<Props = Record<string, unknown>> = (
  props: Props,
  ...children: WpElement[]
) => WpElement;

export interface WpBlockEditProps<Attributes extends Record<string, unknown> = Record<string, unknown>> {
  attributes: Attributes;
  setAttributes: (attributes: Partial<Attributes>) => void;
  clientId: string;
  className?: string;
  isSelected?: boolean;
}

export interface WpBlockSaveProps<Attributes extends Record<string, unknown> = Record<string, unknown>> {
  attributes: Attributes;
}

export interface WpBlockSettings<Attributes extends Record<string, unknown> = Record<string, unknown>> {
  apiVersion?: number;
  title: string;
  category: string;
  icon?: string;
  description?: string;
  supports?: Record<string, unknown>;
  attributes?: Record<keyof Attributes | string, Record<string, unknown>>;
  edit: (props: WpBlockEditProps<Attributes>) => WpElement;
  save?: (props: WpBlockSaveProps<Attributes>) => WpElement;
}

export interface WpMedia {
  id?: number;
  url?: string;
  alt?: string;
  title?: string;
}

export interface WpRichTextProps {
  tagName?: string;
  className?: string;
  value?: string;
  placeholder?: string;
  allowedFormats?: string[];
  onChange?: (value: string) => void;
}

export interface WpRichTextContentProps {
  tagName?: string;
  className?: string;
  value?: string;
}

export interface WpBlockEditor {
  BlockControls: WpComponent<{ group?: string }>;
  InspectorControls: WpComponent;
  MediaPlaceholder: WpComponent<{
    icon?: string;
    labels?: { title?: string; instructions?: string };
    onSelect?: (media: WpMedia) => void;
    accept?: string;
    allowedTypes?: string[];
    multiple?: boolean;
  }>;
  MediaReplaceFlow: WpComponent<{
    mediaId?: number;
    mediaURL?: string;
    allowedTypes?: string[];
    accept?: string;
    onSelect?: (media: WpMedia) => void;
    name?: string;
  }>;
  RichText: WpComponent<WpRichTextProps> & {
    Content: WpComponent<WpRichTextContentProps>;
  };
  useBlockProps: ((props?: Record<string, unknown>) => Record<string, unknown>) & {
    save: (props?: Record<string, unknown>) => Record<string, unknown>;
  };
}

export interface WpGlobal {
  blocks: {
    registerBlockType: <Attributes extends Record<string, unknown> = Record<string, unknown>>(
      name: string,
      settings: WpBlockSettings<Attributes>,
    ) => void;
  };
  blockEditor: WpBlockEditor;
  components: Record<string, WpComponent | undefined> & {
    Button: WpComponent;
    PanelBody: WpComponent<{
      title?: string;
      initialOpen?: boolean;
    }>;
    TextControl: WpComponent<{
      label?: string;
      value?: string;
      help?: string;
      onChange?: (value: string) => void;
    }>;
  };
  element: {
    Fragment: unknown;
    createElement: {
      <Props>(
        type: WpComponent<Props>,
        props?: Props | null,
        ...children: WpElement[]
      ): WpElement;
      (type: unknown, props?: Record<string, unknown> | null, ...children: WpElement[]): WpElement;
    };
  };
}

declare global {
  const wp: WpGlobal;

  interface Window {
    wp: WpGlobal;
  }
}

export {};
