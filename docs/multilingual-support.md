# Multi-Language Support System Documentation

## Overview

The multi-language support system enables the application to display content in multiple languages while maintaining a single database structure. This system separates the base content entities from their language-specific translations, allowing for flexible localization.

## Architecture

### Database Schema

The system uses a base-translations pattern where each content entity (categories, tags) has:

1. **Base Table**: Contains language-neutral information (IDs, relationships, metadata)
2. **Translations Table**: Contains language-specific content (names, descriptions, slugs)

#### Categories

```sql
-- Base categories table (language neutral)
categories (
  id UUID PRIMARY KEY,
  videoCount INTEGER DEFAULT 0,
  createdAt TIMESTAMP DEFAULT NOW()
)

-- Category translations table (language specific)
categoryTranslations (
  id UUID PRIMARY KEY,
  categoryId UUID REFERENCES categories(id),
  languageCode VARCHAR(10), -- e.g., 'en', 'sr-Latn'
  name TEXT,
  slug TEXT,
  description TEXT,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
)
```

#### Tags

```sql
-- Base tags table (language neutral)
tags (
  id UUID PRIMARY KEY,
  videoId UUID REFERENCES videos(id),
  createdAt TIMESTAMP DEFAULT NOW()
)

-- Tag translations table (language specific)
tagTranslations (
  id UUID PRIMARY KEY,
  tagId UUID REFERENCES tags(id),
  languageCode VARCHAR(10), -- e.g., 'en', 'sr-Latn'
  tagName TEXT,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
)
```

### Unique Constraints

Each translations table enforces uniqueness constraints to ensure data integrity:

- `category_translations_category_lang_unique`: Prevents duplicate translations for the same category in the same language
- `category_translations_slug_lang_unique`: Ensures unique slugs per language
- `tag_translations_tag_lang_unique`: Prevents duplicate translations for the same tag in the same language
- `tag_translations_name_lang_unique`: Ensures unique tag names per language

## Implementation

### Storage Layer

The storage layer provides methods for working with localized content:

#### Category Methods

- `createCategory(base, translations)`: Creates a new category with its translations
- `getLocalizedCategory(id, lang)`: Retrieves a category with translations in a specific language
- `getLocalizedCategoryBySlug(slug, lang)`: Finds a category by slug in a specific language
- `getAllLocalizedCategories(lang)`: Gets all categories with translations in a specific language
- `updateLocalizedCategory(id, lang, data)`: Updates category translations for a specific language
- `deleteCategory(id)`: Deletes a category and all its translations
- `addCategoryTranslation(categoryId, translation)`: Adds a new translation for a category
- `deleteCategoryTranslation(categoryId, lang)`: Removes a specific language translation

#### Tag Methods

- `createTag(base, translations)`: Creates a new tag with its translations
- `getLocalizedTag(id, lang)`: Retrieves a tag with translations in a specific language
- `getLocalizedTagByName(name, lang)`: Finds a tag by name in a specific language
- `getAllLocalizedTags(lang)`: Gets all tags with translations in a specific language
- `getLocalizedTagsByVideoId(videoId, lang)`: Gets all tags for a video in a specific language
- `updateLocalizedTag(id, lang, data)`: Updates tag translations for a specific language
- `deleteTag(id)`: Deletes a tag and all its translations
- `addTagTranslation(tagId, translation)`: Adds a new translation for a tag
- `deleteTagTranslation(tagId, lang)`: Removes a specific language translation

### Fallback Mechanism

The system implements a fallback mechanism to ensure content availability:

1. **Primary Lookup**: Try to find content in the requested language
2. **Fallback**: If not found, fall back to English ('en')
3. **Base Content**: If neither exists, return base content without translations

### Caching Strategy

Localized content is cached separately for each language to improve performance:

- Cache keys include the language code (e.g., `categories:localized:en`)
- Different TTL settings can be applied per language if needed
- Cache invalidation occurs when content is updated

## Frontend Integration

### i18n Configuration

The frontend uses `i18next` for internationalization:

- **Supported Languages**: English ('en'), Serbian Latin ('sr-Latn')
- **Fallback Language**: English ('en')
- **Storage**: Language preference is stored in localStorage

### Component Localization

Components use the `useTranslation` hook to access localized strings:

```javascript
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t, i18n } = useTranslation();
  
  // Change language
  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('language', lng);
  };
  
  return (
    <div>
      <h1>{t('categories.title')}</h1>
      <p>{t('categories.description')}</p>
    </div>
  );
};
```

### Dynamic Content Localization

Dynamic content (categories, tags) is fetched with language awareness:

```javascript
// Fetch categories in current language
const { data: categories } = useQuery({
  queryKey: ['categories', i18n.language],
  queryFn: () => fetch(`/api/categories?lang=${i18n.language}`)
});
```

## API Endpoints

### Categories

- `GET /api/categories?lang=:language`: Get all categories in specified language
- `GET /api/categories/:id?lang=:language`: Get specific category in specified language
- `POST /api/categories`: Create new category with translations
- `PUT /api/categories/:id/:language`: Update category translations
- `DELETE /api/categories/:id`: Delete category and all translations

### Tags

- `GET /api/tags?lang=:language`: Get all tags in specified language
- `GET /api/tags/:id?lang=:language`: Get specific tag in specified language
- `GET /api/videos/:videoId/tags?lang=:language`: Get tags for a video in specified language
- `POST /api/tags`: Create new tag with translations
- `PUT /api/tags/:id/:language`: Update tag translations
- `DELETE /api/tags/:id`: Delete tag and all translations

## Best Practices

### Adding New Languages

1. **Database**: No schema changes needed - translations are stored dynamically
2. **Frontend**: Add new locale JSON file in `client/src/i18n/locales/`
3. **Configuration**: Update `client/src/i18n/config.ts` to include the new language
4. **Content**: Create translations for existing categories/tags through admin interface

### Content Management

1. **Admin Interface**: Manage translations through the admin panel
2. **Validation**: Ensure unique slugs and names per language
3. **Fallback**: Always provide English translations as fallback
4. **Consistency**: Maintain consistent terminology across languages

### Performance Optimization

1. **Caching**: Leverage caching for localized content
2. **Batch Operations**: Use bulk operations when creating/updating multiple translations
3. **Indexing**: Ensure database indexes on languageCode columns for fast lookups
4. **Lazy Loading**: Load translations only when needed

## Error Handling

### Common Issues

1. **Missing Translations**: System falls back to English or base content
2. **Invalid Language Codes**: Requests with unsupported languages fall back to default
3. **Duplicate Content**: Database constraints prevent duplicate translations
4. **Cache Misses**: System gracefully handles cache misses with direct database queries

### Debugging

1. **Check Database**: Verify translations exist in the database
2. **Verify Language Code**: Ensure requested language code is supported
3. **Cache Status**: Check if cached content is being served correctly
4. **Fallback Chain**: Confirm fallback mechanism is working properly

## Future Enhancements

### Planned Features

1. **RTL Support**: Right-to-left language support for Arabic, Hebrew, etc.
2. **Language Detection**: Automatic language detection based on user preferences
3. **Translation Management**: Dedicated admin interface for managing translations
4. **Content Versioning**: Track changes to translations over time
5. **Machine Translation**: Integration with translation APIs for automatic translation

### Scalability Considerations

1. **Database Sharding**: Potential sharding by language for large-scale deployments
2. **CDN Integration**: Language-specific CDN caching strategies
3. **Performance Monitoring**: Metrics on translation lookup performance
4. **Content Distribution**: Efficient distribution of translation updates

## Maintenance

### Regular Tasks

1. **Cache Cleanup**: Periodic cache invalidation for updated content
2. **Translation Audits**: Regular review of translation quality and completeness
3. **Performance Monitoring**: Monitor query performance for translation lookups
4. **Backup Strategy**: Include translation data in backup procedures

### Troubleshooting

1. **Missing Content**: Check if translations exist for the requested language
2. **Display Issues**: Verify language code formatting and fallback configuration
3. **Performance Problems**: Review database indexes and caching configuration
4. **Update Failures**: Check constraint violations and data integrity issues