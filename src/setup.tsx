import { RouteObject } from "react-router-dom";
import { AbortContext, AbortController, createAbortedController } from "./abort";
import { Home } from "./component/home";
import { createUserStore } from "./store/user";
import { RootProvider } from "./store/root-context";
import toast from "react-hot-toast";

export interface AppContext {
    userStore: ReturnType<typeof createUserStore>,
    rootAbortController: AbortController,
    routes: RouteObject[]
}

/**
 * 在 Loading 状态时展示一个 toast，并在 loading 成功后 1000ms 后自动关闭
 * 
 * @param pageAbortContext 
 * @param userStore 
 */
function setupLoadingToastWithPerfectCleanup(pageAbortContext: AbortContext, userStore: ReturnType<typeof createUserStore>) {
    let loadingToastId: string | null = null;
    // 切换页面时立即取消 toast
    pageAbortContext.onAbort(() => {
        if (loadingToastId) {
            toast.dismiss(loadingToastId)
        }
    })

    pageAbortContext.onAbort(userStore.subscribe(state => {
        if (state._loading && !loadingToastId) {
            loadingToastId = toast.loading('Loading...')
        }

        if (!state._loading && loadingToastId) {
            const currToastId = loadingToastId
            loadingToastId = null

            const timer = setTimeout(() => {
                toast.dismiss(currToastId)
            }, 1000)
            pageAbortContext.onAbort(() => {
                clearTimeout(timer)
            })
        }
    }))
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function setupLoadingToastWithoutCleanup(ctx: AbortContext, userStore: ReturnType<typeof createUserStore>) {
    let loadingToastId: string | null = null;
    ctx.onAbort(userStore.subscribe(state => {
        if (state._loading && !loadingToastId) {
            loadingToastId = toast.loading('Loading...')
        }

        if (!state._loading && loadingToastId) {
            const currToastId = loadingToastId
            setTimeout(() => {
                toast.dismiss(currToastId)
            }, 1000)

            loadingToastId = null
        }
    }))
}

export function setupApp(): AppContext {
    const userStore = createUserStore()
    const rootAbortController = createAbortedController({ debugLabel: 'root' })
    const abortContextWrapper = rootAbortController.createAbortSwitchWrapper({ debugLabel: 'route' })

    function setupHomePage(ctx: AbortContext) {
        // 下面的写法可以阻塞页面加载，让 router 展示全局 loading
        // await userStore.getState().fetch(ctx)

        setupLoadingToastWithPerfectCleanup(ctx, userStore)
        // setupLoadingToastWithoutCleanup(ctx, userStore)

        // user name 不阻塞页面加载，局部展示 loading
        void userStore.getState().fetch(ctx)
        return Promise.resolve(null)
    }

    return {
        userStore,
        rootAbortController,
        routes: [
            {
                path: '/',

                element: <RootProvider userStore={userStore} rootAbortContext={rootAbortController}>
                    <Home />
                </RootProvider>,

                loader: abortContextWrapper(setupHomePage)
            },
            {
                path: '/foo',

                element: <RootProvider userStore={userStore} rootAbortContext={rootAbortController}>
                    <div>Foo Page</div>
                </RootProvider>,

                loader: abortContextWrapper(() => Promise.resolve(null))
            }
        ]
    }
}
