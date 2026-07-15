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
	public class OracleStore : Store, IORMToolServices, IFrameworkServices, IModelingEventManagerProvider, ISerializationContextHost, IORMFontAndColorService
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
			get { return this; }
		}
		// IORMFontAndColorService: the verbalization document header reads
		// fonts/colors through the store; serve the designer defaults (the
		// same values VerbalizationManager.CategoryFontData defaults to).
		System.Drawing.Color IORMFontAndColorService.GetForeColor(ORMDesignerColor colorIndex)
		{
			switch (colorIndex)
			{
				case ORMDesignerColor.VerbalizerPredicateText: return System.Drawing.Color.DarkGreen;
				case ORMDesignerColor.VerbalizerObjectName: return System.Drawing.Color.Purple;
				case ORMDesignerColor.VerbalizerFormalItem: return System.Drawing.Color.MediumBlue;
				case ORMDesignerColor.VerbalizerNotesItem: return System.Drawing.Color.Black;
				case ORMDesignerColor.VerbalizerRefMode: return System.Drawing.Color.Brown;
				case ORMDesignerColor.VerbalizerInstanceValue: return System.Drawing.Color.Brown;
			}
			return System.Drawing.Color.Black;
		}
		System.Drawing.Color IORMFontAndColorService.GetBackColor(ORMDesignerColor colorIndex)
		{
			return System.Drawing.Color.White;
		}
		System.Drawing.Font IORMFontAndColorService.GetFont(ORMDesignerColorCategory fontCategory)
		{
			// the document header multiplies Size by 72 expecting inches
			return new System.Drawing.Font("Tahoma", 8.0F / 72.0F, System.Drawing.GraphicsUnit.Inch);
		}
		System.Drawing.FontStyle IORMFontAndColorService.GetFontStyle(ORMDesignerColor colorIndex)
		{
			return colorIndex == ORMDesignerColor.VerbalizerFormalItem ? System.Drawing.FontStyle.Bold : System.Drawing.FontStyle.Regular;
		}
		IServiceProvider IORMToolServices.ServiceProvider
		{
			get { return null; }
		}
		// Verbalization services, shaped after ORMStandaloneStore (Load/
		// ModelLoader.cs): targets and options come from attributes on the
		// loaded domain models; snippets load through the documented
		// VerbalizationSnippetSetsManager entry point (defaults are embedded
		// in the domain-model assemblies; the directory only adds overrides).
		private IDictionary<string, VerbalizationTargetData> myVerbalizationTargets;
		IDictionary<string, VerbalizationTargetData> IORMToolServices.VerbalizationTargets
		{
			get
			{
				IDictionary<string, VerbalizationTargetData> retVal = myVerbalizationTargets;
				if (retVal == null)
				{
					retVal = new Dictionary<string, VerbalizationTargetData>();
					foreach (DomainModel domainModel in this.DomainModels)
					{
						Type domainModelType = domainModel.GetType();
						object[] providers = domainModelType.GetCustomAttributes(typeof(VerbalizationTargetProviderAttribute), false);
						if (providers.Length != 0)
						{
							IVerbalizationTargetProvider provider = ((VerbalizationTargetProviderAttribute)providers[0]).CreateTargetProvider(domainModelType);
							if (provider != null)
							{
								VerbalizationTargetData[] targets = provider.ProvideVerbalizationTargets();
								if (targets != null)
								{
									for (int i = 0; i < targets.Length; ++i)
									{
										retVal[targets[i].KeyName] = targets[i];
									}
								}
							}
						}
					}
					myVerbalizationTargets = retVal;
				}
				return retVal;
			}
		}
		private IDictionary<string, IDictionary<Type, IVerbalizationSets>> myTargetedVerbalizationSnippets;
		public string[] SnippetsDirectories = { "." };
		IDictionary<Type, IVerbalizationSets> IORMToolServices.GetVerbalizationSnippetsDictionary(string target)
		{
			IDictionary<string, IDictionary<Type, IVerbalizationSets>> targetedSnippets = myTargetedVerbalizationSnippets;
			if (targetedSnippets == null)
			{
				myTargetedVerbalizationSnippets = targetedSnippets = new Dictionary<string, IDictionary<Type, IVerbalizationSets>>();
			}
			IDictionary<Type, IVerbalizationSets> retVal;
			if (!targetedSnippets.TryGetValue(target, out retVal))
			{
				targetedSnippets[target] = retVal = VerbalizationSnippetSetsManager.LoadSnippetsDictionary(this, target, SnippetsDirectories, null);
			}
			return retVal;
		}
		private IExtensionVerbalizerService myExtensionVerbalizerService;
		IExtensionVerbalizerService IORMToolServices.ExtensionVerbalizerService
		{
			get { return myExtensionVerbalizerService ?? (myExtensionVerbalizerService = new ExtensionVerbalizerService(this)); }
		}
		private IDictionary<string, object> myVerbalizationOptions;
		IDictionary<string, object> IORMToolServices.VerbalizationOptions
		{
			get
			{
				IDictionary<string, object> options = myVerbalizationOptions;
				if (options == null)
				{
					myVerbalizationOptions = options = new Dictionary<string, object>();
					foreach (DomainModel domainModel in this.DomainModels)
					{
						Type domainModelType = domainModel.GetType();
						object[] providers = domainModelType.GetCustomAttributes(typeof(VerbalizationOptionProviderAttribute), false);
						if (providers.Length != 0)
						{
							IVerbalizationOptionProvider provider = ((VerbalizationOptionProviderAttribute)providers[0]).CreateOptionProvider(domainModelType);
							if (provider != null)
							{
								VerbalizationOptionData[] data = provider.ProvideVerbalizationOptions();
								if (data != null)
								{
									for (int i = 0; i < data.Length; ++i)
									{
										options[data[i].Name] = data[i].DefaultValue;
									}
								}
							}
						}
					}
				}
				return options;
			}
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
