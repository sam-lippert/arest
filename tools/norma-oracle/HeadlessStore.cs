// The NORMA oracle's headless store: a Microsoft.VisualStudio.Modeling.Store
// hosting NORMA's ORM object model outside Visual Studio, so the Elysium
// readings can be verified against the reference ORM 2 implementation.
// Shaped after NORMA's own ORM2CommandLineTest ORMStore (the designed non-VS
// entry point); UI-facing services are inert stubs.
using System;
using System.Collections.Generic;
using Microsoft.VisualStudio.Modeling;
using Microsoft.VisualStudio.Modeling.Diagrams;
using ORMSolutions.ORMArchitect.Core.ObjectModel;
using ORMSolutions.ORMArchitect.Core.Shell;
using ORMSolutions.ORMArchitect.Framework;
using ORMSolutions.ORMArchitect.Framework.Design;
using ORMSolutions.ORMArchitect.Framework.Diagrams;
using ORMSolutions.ORMArchitect.Framework.Shell;
using ORMSolutions.ORMArchitect.Framework.Shell.DynamicSurveyTreeGrid;

namespace Elysium.NormaOracle
{
	public class OracleStore : Store, IORMToolServices, IFrameworkServices, IModelingEventManagerProvider, ISerializationContextHost
	{
		private readonly ModelingEventManager myEventManager;
		public OracleStore()
		{
			myEventManager = new EventManagerImpl(this);
		}

		#region event manager
		private sealed class EventManagerImpl : ModelingEventManager
		{
			public EventManagerImpl(Store store) : base(store) { }
			protected override void DisplayException(Exception ex)
			{
				Console.Error.WriteLine("[event-exception] " + ex.Message);
			}
		}
		ModelingEventManager IModelingEventManagerProvider.ModelingEventManager
		{
			get { return myEventManager; }
		}
		#endregion

		#region framework services
		private PropertyProviderService myPropertyProviderService;
		IPropertyProviderService IFrameworkServices.PropertyProviderService
		{
			get { return myPropertyProviderService ?? (myPropertyProviderService = new PropertyProviderService(this)); }
		}
		private TypedDomainModelProviderCache myTypedDomainModelCache;
		T[] IFrameworkServices.GetTypedDomainModelProviders<T>()
		{
			if (myTypedDomainModelCache == null) myTypedDomainModelCache = new TypedDomainModelProviderCache(this);
			return myTypedDomainModelCache.GetTypedDomainModelProviders<T>(false);
		}
		T[] IFrameworkServices.GetTypedDomainModelProviders<T>(bool dependencyOrder)
		{
			if (myTypedDomainModelCache == null) myTypedDomainModelCache = new TypedDomainModelProviderCache(this);
			return myTypedDomainModelCache.GetTypedDomainModelProviders<T>(dependencyOrder);
		}
		private CopyClosureManager myCopyClosureManager;
		ICopyClosureManager IFrameworkServices.CopyClosureManager
		{
			get { return myCopyClosureManager ?? (myCopyClosureManager = new CopyClosureManager(this)); }
		}
		AutomatedElementDirective IFrameworkServices.GetAutomatedElementDirective(ModelElement element)
		{
			AutomatedElementFilterCallback filter = myAutomatedElementFilter;
			AutomatedElementDirective retVal = AutomatedElementDirective.None;
			if (filter != null)
			{
				foreach (AutomatedElementFilterCallback callback in filter.GetInvocationList())
				{
					AutomatedElementDirective directive = callback(element);
					switch (directive)
					{
						case AutomatedElementDirective.NeverIgnore:
							return directive;
						case AutomatedElementDirective.Ignore:
							retVal = directive;
							break;
					}
				}
			}
			return retVal;
		}
		private AutomatedElementFilterCallback myAutomatedElementFilter;
		event AutomatedElementFilterCallback IFrameworkServices.AutomatedElementFilter
		{
			add { myAutomatedElementFilter += value; }
			remove { myAutomatedElementFilter -= value; }
		}
		INotifySurveyElementChanged IFrameworkServices.NotifySurveyElementChanged
		{
			get { return null; }
		}
		#endregion

		#region ORM tool services
		private sealed class ErrorActivationService : IORMModelErrorActivationService
		{
			bool IORMModelErrorActivationService.ActivateError(ModelElement selectedElement, ModelError error) { return false; }
			void IORMModelErrorActivationService.RegisterErrorActivator(Type elementType, bool registerDerivedTypes, ORMModelErrorActivator activator) { }
		}
		private IORMModelErrorActivationService myActivationService;
		IORMModelErrorActivationService IORMToolServices.ModelErrorActivationService
		{
			get { return myActivationService ?? (myActivationService = new ErrorActivationService()); }
		}
		private IORMExtendableElementService myExtendableElementService;
		IORMExtendableElementService IORMToolServices.ExtendableElementService
		{
			get { return myExtendableElementService ?? (myExtendableElementService = ExtendableElementUtility.CreateExtendableElementService(this)); }
		}
		IORMToolTaskProvider IORMToolServices.TaskProvider
		{
			get { throw new NotSupportedException("norma-oracle: TaskProvider is display-side and not hosted"); }
		}
		bool IORMToolServices.CanAddTransaction
		{
			get { return true; }
			set { }
		}
		bool IORMToolServices.ProcessingVisibleTransactionItemEvents
		{
			get { return true; }
			set { }
		}
		IORMFontAndColorService IORMToolServices.FontAndColorService
		{
			get { return null; }
		}
		IServiceProvider IORMToolServices.ServiceProvider
		{
			get { return null; }
		}
		private IDictionary<string, VerbalizationTargetData> myVerbalizationTargets;
		IDictionary<string, VerbalizationTargetData> IORMToolServices.VerbalizationTargets
		{
			get { return myVerbalizationTargets ?? (myVerbalizationTargets = new Dictionary<string, VerbalizationTargetData>()); }
		}
		IDictionary<Type, IVerbalizationSets> IORMToolServices.GetVerbalizationSnippetsDictionary(string target)
		{
			return null;
		}
		IExtensionVerbalizerService IORMToolServices.ExtensionVerbalizerService
		{
			get { return null; }
		}
		private IDictionary<string, object> myVerbalizationOptions;
		IDictionary<string, object> IORMToolServices.VerbalizationOptions
		{
			get { return myVerbalizationOptions ?? (myVerbalizationOptions = new Dictionary<string, object>()); }
		}
		LayoutEngine IORMToolServices.GetLayoutEngine(Type engineType)
		{
			throw new NotSupportedException("norma-oracle: no layout engines headless");
		}
		bool IORMToolServices.ActivateShape(ShapeElement shape, NavigateToWindow window)
		{
			return false;
		}
		bool IORMToolServices.NavigateTo(object element, NavigateToWindow window)
		{
			return false;
		}
		bool IORMToolServices.NavigateTo(object element, NavigateToWindow window, NavigateToOptions options)
		{
			return false;
		}
		#endregion

		#region serialization context
		private ISerializationContext mySerializationContext;
		ISerializationContext ISerializationContextHost.SerializationContext
		{
			get { return mySerializationContext; }
			set { mySerializationContext = value; }
		}
		#endregion
	}
}
