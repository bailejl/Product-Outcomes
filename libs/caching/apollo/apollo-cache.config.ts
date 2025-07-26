import { InMemoryCache, InMemoryCacheConfig } from '@apollo/client';
import { offsetLimitPagination, relayStylePagination } from '@apollo/client/utilities';

export interface ApolloCustomCacheConfig extends InMemoryCacheConfig {
  enableOptimisticUI: boolean;
  enablePersistence: boolean;
  maxCacheSize: number;
  evictionPolicy: 'lru' | 'lfu' | 'ttl';
  debugMode: boolean;
}

export function createApolloCache(config: Partial<ApolloCustomCacheConfig> = {}): InMemoryCache {
  const defaultConfig: ApolloCustomCacheConfig = {
    enableOptimisticUI: true,
    enablePersistence: false,
    maxCacheSize: 50 * 1024 * 1024, // 50MB
    evictionPolicy: 'lru',
    debugMode: false,
    ...config
  };

  const cache = new InMemoryCache({
    addTypename: true,
    
    // Type policies for cache normalization and optimization
    typePolicies: {
      User: {
        fields: {
          // Cache user data for 5 minutes
          profile: {
            read(existing, { readField }) {
              if (existing) {
                const lastUpdated = readField('lastUpdated', existing);
                const now = Date.now();
                if (lastUpdated && (now - lastUpdated) < 300000) { // 5 minutes
                  return existing;
                }
              }
              return existing;
            }
          },
          
          // Paginated user posts
          posts: relayStylePagination(['filters']),
          
          // User preferences with optimistic updates
          preferences: {
            merge(existing = {}, incoming) {
              return { ...existing, ...incoming };
            }
          }
        }
      },

      Product: {
        fields: {
          // Product reviews with pagination
          reviews: relayStylePagination(['sortBy', 'filterBy']),
          
          // Related products
          relatedProducts: {
            merge(existing = [], incoming = []) {
              return [...existing, ...incoming.filter((item: any) => 
                !existing.some((existingItem: any) => existingItem.__ref === item.__ref)
              )];
            }
          },
          
          // Inventory with real-time updates
          inventory: {
            merge(existing, incoming) {
              return {
                ...existing,
                ...incoming,
                lastUpdated: Date.now()
              };
            }
          }
        }
      },

      Category: {
        fields: {
          // Category products with filtering
          products: offsetLimitPagination(['filters', 'sortBy']),
          
          // Nested subcategories
          subcategories: {
            merge(existing = [], incoming = []) {
              return incoming;
            }
          }
        }
      },

      Cart: {
        fields: {
          items: {
            merge(existing = [], incoming = []) {
              const existingItems = new Map(
                existing.map((item: any) => [item.__ref || item.id, item])
              );
              
              incoming.forEach((item: any) => {
                existingItems.set(item.__ref || item.id, item);
              });
              
              return Array.from(existingItems.values());
            }
          },
          
          // Calculate total dynamically
          total: {
            read(existing, { readField }) {
              const items = readField('items') as any[];
              if (!items) return existing;
              
              return items.reduce((total, item) => {
                const price = readField('price', item) || 0;
                const quantity = readField('quantity', item) || 0;
                return total + (price * quantity);
              }, 0);
            }
          }
        }
      },

      // Queries
      Query: {
        fields: {
          // Dashboard data with short TTL
          dashboardData: {
            read(existing) {
              if (existing) {
                const lastFetched = existing.lastFetched;
                const now = Date.now();
                if (lastFetched && (now - lastFetched) < 60000) { // 1 minute
                  return existing;
                }
              }
              return existing;
            }
          },
          
          // Search results
          searchProducts: offsetLimitPagination(['query', 'filters']),
          
          // User feed
          userFeed: relayStylePagination(['filters']),
          
          // Popular products (cached longer)
          popularProducts: {
            read(existing) {
              if (existing) {
                const lastFetched = existing.lastFetched;
                const now = Date.now();
                if (lastFetched && (now - lastFetched) < 1800000) { // 30 minutes
                  return existing;
                }
              }
              return existing;
            }
          }
        }
      }
    },

    // Custom field policies for data fetching optimization
    possibleTypes: {
      Node: ['User', 'Product', 'Category', 'Order', 'Review'],
      Media: ['Image', 'Video'],
      SearchResult: ['Product', 'Category', 'User']
    },

    // Data ID from object
    dataIdFromObject(object: any) {
      switch (object.__typename) {
        case 'User':
        case 'Product':
        case 'Category':
        case 'Order':
          return `${object.__typename}:${object.id}`;
        case 'CartItem':
          return `CartItem:${object.productId}`;
        default:
          return null;
      }
    },

    ...defaultConfig
  });

  // Add cache event listeners for monitoring
  if (defaultConfig.debugMode) {
    setupCacheDebugging(cache);
  }

  return cache;
}

export const optimisticResponseConfig = {
  // Optimistic response for adding item to cart
  addToCart: {
    __typename: 'Mutation' as const,
    addToCart: {
      __typename: 'CartItem' as const,
      id: 'temp-id',
      quantity: 1,
      addedAt: new Date().toISOString(),
      product: {
        __typename: 'Product' as const,
        // Product fields will be filled by variables
      }
    }
  },

  // Optimistic response for updating user profile
  updateUserProfile: {
    __typename: 'Mutation' as const,
    updateUserProfile: {
      __typename: 'User' as const,
      // User fields will be filled by variables
      lastUpdated: new Date().toISOString()
    }
  },

  // Optimistic response for creating review
  createReview: {
    __typename: 'Mutation' as const,
    createReview: {
      __typename: 'Review' as const,
      id: 'temp-review-id',
      createdAt: new Date().toISOString(),
      status: 'pending',
      // Other fields from variables
    }
  },

  // Optimistic response for updating preferences
  updatePreferences: {
    __typename: 'Mutation' as const,
    updatePreferences: {
      __typename: 'UserPreferences' as const,
      lastUpdated: new Date().toISOString(),
      // Preferences will be merged with existing
    }
  }
};

export const cacheUpdateStrategies = {
  // Update cache after adding item to cart
  afterAddToCart: (cache: InMemoryCache, { data }: any) => {
    if (!data?.addToCart) return;

    // Update cart query
    const existingCart = cache.readQuery({
      query: GET_CART_QUERY
    });

    if (existingCart) {
      cache.writeQuery({
        query: GET_CART_QUERY,
        data: {
          cart: {
            ...existingCart.cart,
            items: [...existingCart.cart.items, data.addToCart],
            updatedAt: new Date().toISOString()
          }
        }
      });
    }

    // Update product inventory
    cache.modify({
      id: cache.identify(data.addToCart.product),
      fields: {
        inventory(existingInventory) {
          return {
            ...existingInventory,
            available: Math.max(0, existingInventory.available - data.addToCart.quantity)
          };
        }
      }
    });
  },

  // Update cache after removing item from cart
  afterRemoveFromCart: (cache: InMemoryCache, { data }: any, variables: any) => {
    if (!data?.removeFromCart) return;

    cache.modify({
      id: cache.identify({ __typename: 'Cart', id: variables.cartId }),
      fields: {
        items(existingItems, { readField }) {
          return existingItems.filter((itemRef: any) => 
            readField('id', itemRef) !== variables.itemId
          );
        }
      }
    });
  },

  // Update cache after creating review
  afterCreateReview: (cache: InMemoryCache, { data }: any) => {
    if (!data?.createReview) return;

    const productId = data.createReview.product.id;
    
    // Update product reviews list
    cache.modify({
      id: cache.identify({ __typename: 'Product', id: productId }),
      fields: {
        reviews(existingReviews = { edges: [], pageInfo: {} }) {
          const newReview = {
            __typename: 'ReviewEdge',
            node: data.createReview,
            cursor: data.createReview.id
          };
          
          return {
            ...existingReviews,
            edges: [newReview, ...existingReviews.edges]
          };
        },
        reviewCount(existing = 0) {
          return existing + 1;
        },
        averageRating(existing = 0, { readField }) {
          const reviewCount = readField('reviewCount') || 0;
          const newRating = data.createReview.rating;
          return ((existing * (reviewCount - 1)) + newRating) / reviewCount;
        }
      }
    });
  },

  // Update cache after user profile update
  afterUpdateProfile: (cache: InMemoryCache, { data }: any) => {
    if (!data?.updateUserProfile) return;

    // The cache will automatically update the User object
    // due to automatic cache normalization
    
    // Update any query that includes user data
    cache.modify({
      id: cache.identify(data.updateUserProfile),
      fields: {
        lastUpdated() {
          return new Date().toISOString();
        }
      }
    });
  }
};

// Cache warming queries for initial load
export const cacheWarmupQueries = [
  {
    query: GET_CATEGORIES_QUERY,
    variables: {},
    fetchPolicy: 'cache-first' as const
  },
  {
    query: GET_POPULAR_PRODUCTS_QUERY,
    variables: { limit: 20 },
    fetchPolicy: 'cache-first' as const
  },
  {
    query: GET_USER_PREFERENCES_QUERY,
    variables: {},
    fetchPolicy: 'cache-first' as const
  }
];

// Cache eviction policies
export const cacheEvictionRules = {
  // Evict old search results
  evictOldSearches: (cache: InMemoryCache) => {
    const searchFields = cache.extract()?.ROOT_QUERY?.searchProducts;
    if (searchFields && Object.keys(searchFields).length > 50) {
      // Keep only the 20 most recent searches
      // Implementation would sort by access time and evict oldest
    }
  },

  // Evict user-specific data on logout
  evictUserData: (cache: InMemoryCache, userId: string) => {
    cache.evict({ id: `User:${userId}` });
    cache.evict({ id: `Cart:${userId}` });
    cache.evict({ fieldName: 'currentUser' });
    cache.evict({ fieldName: 'userPreferences' });
    cache.gc(); // Garbage collect
  },

  // Evict stale product data
  evictStaleProducts: (cache: InMemoryCache, maxAge: number = 3600000) => {
    const now = Date.now();
    const extract = cache.extract();
    
    Object.keys(extract).forEach(key => {
      if (key.startsWith('Product:')) {
        const product = extract[key];
        if (product.lastUpdated && (now - product.lastUpdated) > maxAge) {
          cache.evict({ id: key });
        }
      }
    });
    
    cache.gc();
  }
};

function setupCacheDebugging(cache: InMemoryCache): void {
  // Log cache hits and misses
  const originalReadQuery = cache.readQuery.bind(cache);
  cache.readQuery = function(options: any) {
    const result = originalReadQuery(options);
    console.log('Cache read:', {
      query: options.query?.definitions?.[0]?.name?.value,
      hit: !!result,
      variables: options.variables
    });
    return result;
  };

  // Log cache writes
  const originalWriteQuery = cache.writeQuery.bind(cache);
  cache.writeQuery = function(options: any) {
    console.log('Cache write:', {
      query: options.query?.definitions?.[0]?.name?.value,
      variables: options.variables
    });
    return originalWriteQuery(options);
  };

  // Log cache modifications
  const originalModify = cache.modify.bind(cache);
  cache.modify = function(options: any) {
    console.log('Cache modify:', {
      id: options.id,
      fields: Object.keys(options.fields || {})
    });
    return originalModify(options);
  };
}

// Placeholder queries (would be imported from your GraphQL schema)
const GET_CART_QUERY = `
  query GetCart {
    cart {
      id
      items {
        id
        quantity
        product {
          id
          name
          price
        }
      }
      total
      updatedAt
    }
  }
`;

const GET_CATEGORIES_QUERY = `
  query GetCategories {
    categories {
      id
      name
      slug
      productCount
    }
  }
`;

const GET_POPULAR_PRODUCTS_QUERY = `
  query GetPopularProducts($limit: Int!) {
    popularProducts(limit: $limit) {
      id
      name
      price
      image
      rating
    }
  }
`;

const GET_USER_PREFERENCES_QUERY = `
  query GetUserPreferences {
    userPreferences {
      theme
      language
      notifications
      currency
    }
  }
`;