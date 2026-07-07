const { registerBlockType } = wp.blocks;
const { Button } = wp.components;
const { MediaUpload, MediaUploadCheck, RichText, useBlockProps } = wp.blockEditor;
const { createElement: h, Fragment } = wp.element;

const attributes = {
  headline: {
    type: 'string',
    source: 'html',
    selector: 'h1',
  },
  imageId: {
    type: 'number',
  },
  imageUrl: {
    type: 'string',
    source: 'attribute',
    selector: 'img',
    attribute: 'src',
  },
  imageAlt: {
    type: 'string',
    source: 'attribute',
    selector: 'img',
    attribute: 'alt',
  },
};

registerBlockType('vitewp/hero', {
  apiVersion: 3,
  title: 'ViteWP Hero',
  category: 'design',
  icon: 'format-image',
  description: 'A simple ViteWP test block with a media-library image and headline.',
  supports: {
    html: false,
  },
  attributes,

  edit({ attributes, setAttributes }) {
    const { headline = '', imageId, imageUrl = '', imageAlt = '' } = attributes;
    const blockProps = useBlockProps({ className: 'vitewp-hero' });

    const mediaUpload = (buttonLabel, variant = 'secondary') => h(MediaUploadCheck, null,
      h(MediaUpload, {
        onSelect: (media) => setAttributes({
          imageId: media.id,
          imageUrl: media.url,
          imageAlt: media.alt || media.title || '',
        }),
        allowedTypes: ['image'],
        value: imageId,
        render: ({ open }) => h(Button, { variant, onClick: open }, buttonLabel),
      })
    );

    return h('section', blockProps,
      h('div', { className: 'vitewp-hero__media' },
        imageUrl
          ? h(Fragment, null,
              h('img', { src: imageUrl, alt: imageAlt || '' }),
              mediaUpload('Replace image')
            )
          : mediaUpload('Choose hero image', 'primary')
      ),
      h('div', { className: 'vitewp-hero__content' },
        h(RichText, {
          tagName: 'h1',
          value: headline,
          placeholder: 'Write a hero headline…',
          allowedFormats: [],
          onChange: (value) => setAttributes({ headline: value }),
        })
      )
    );
  },

  save({ attributes }) {
    const { headline = '', imageUrl = '', imageAlt = '' } = attributes;
    const blockProps = wp.blockEditor.useBlockProps.save({ className: 'vitewp-hero' });

    return h('section', blockProps,
      imageUrl && h('div', { className: 'vitewp-hero__media' },
        h('img', { src: imageUrl, alt: imageAlt || '' })
      ),
      h('div', { className: 'vitewp-hero__content' },
        h(RichText.Content, { tagName: 'h1', value: headline })
      )
    );
  },
});
